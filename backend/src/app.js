require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const { createClient } = require("redis");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/todoapp";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost";
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(__dirname, "../uploads");
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024;

const ENABLE_ANALYTICS = process.env.ENABLE_ANALYTICS !== "false";
const ENABLE_FILE_UPLOAD = process.env.ENABLE_FILE_UPLOAD !== "false";

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* =========================
   Middleware
========================= */

app.use(helmet());

app.use(
  cors({
    origin: CORS_ORIGIN,
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/uploads", express.static(UPLOAD_DIR));

/* =========================
   MongoDB
========================= */

const todoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    completed: {
      type: Boolean,
      default: false,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    dueDate: {
      type: Date,
      default: null,
    },

    attachments: {
      type: [
        {
          filename: String,
          originalName: String,
          mimetype: String,
          size: Number,
          path: String,
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

todoSchema.index({ createdAt: -1 });
todoSchema.index({ completed: 1 });
todoSchema.index({ priority: 1 });
todoSchema.index({ dueDate: 1 });

const Todo = mongoose.model("Todo", todoSchema);

/* =========================
   Redis
========================= */

const redisClient = createClient({
  url: REDIS_URL,
});

let redisConnected = false;
let mongoConnected = false;

redisClient.on("connect", () => {
  console.log("Redis connecting...");
});

redisClient.on("ready", () => {
  redisConnected = true;
  console.log("Redis connected");
});

redisClient.on("error", (error) => {
  redisConnected = false;
  console.error("Redis error:", error.message);
});

redisClient.on("end", () => {
  redisConnected = false;
  console.log("Redis disconnected");
});

/* =========================
   Multer
========================= */

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    const baseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    cb(
      null,
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${baseName}${extension}`
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },

  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }

    cb(null, true);
  },
});

/* =========================
   Cache helpers
========================= */

async function clearTodoCache() {
  if (!redisConnected) {
    return;
  }

  try {
    const keys = await redisClient.keys("todos:*");

    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error("Redis cache clear error:", error.message);
  }
}

/* =========================
   Health
========================= */

app.get("/health", (req, res) => {
  const healthy = mongoConnected && redisConnected;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "healthy" : "unhealthy",
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    mongo: mongoConnected ? "connected" : "disconnected",
    redis: redisConnected ? "connected" : "disconnected",
    memory: process.memoryUsage(),
    hostname: require("os").hostname(),
  });
});

/* =========================
   Test
========================= */

app.get("/api/test", (req, res) => {
  res.json({
    message: "Backend API is working",
  });
});

/* =========================
   GET /api/todos
========================= */

app.get("/api/todos", async (req, res, next) => {
  try {
    const {
      completed,
      priority,
      page = 1,
      limit = 50,
    } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

    const filter = {};

    if (completed === "true") {
      filter.completed = true;
    }

    if (completed === "false") {
      filter.completed = false;
    }

    if (priority && ["low", "medium", "high"].includes(priority)) {
      filter.priority = priority;
    }

    const cacheKey = `todos:${JSON.stringify({
      filter,
      page: currentPage,
      limit: currentLimit,
    })}`;

    if (redisConnected) {
      try {
        const cached = await redisClient.get(cacheKey);

        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch (error) {
        console.error("Redis read error:", error.message);
      }
    }

    const skip = (currentPage - 1) * currentLimit;

    const [todos, total] = await Promise.all([
      Todo.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(currentLimit),

      Todo.countDocuments(filter),
    ]);

    const result = {
      data: todos,
      pagination: {
        page: currentPage,
        limit: currentLimit,
        total,
        pages: Math.ceil(total / currentLimit),
      },
    };

    if (redisConnected) {
      try {
        await redisClient.setEx(cacheKey, 60, JSON.stringify(result));
      } catch (error) {
        console.error("Redis write error:", error.message);
      }
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/* =========================
   POST /api/todos
========================= */

app.post(
  "/api/todos",
  ENABLE_FILE_UPLOAD ? upload.array("attachments", 5) : (req, res, next) => next(),
  async (req, res, next) => {
    try {
      const { title, description, completed, priority, dueDate } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({
          message: "Title is required",
        });
      }

      const attachments = (req.files || []).map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: `/uploads/${file.filename}`,
      }));

      const todo = await Todo.create({
        title: title.trim(),
        description: description || "",
        completed:
          completed === true ||
          completed === "true",
        priority: ["low", "medium", "high"].includes(priority)
          ? priority
          : "medium",
        dueDate: dueDate || null,
        attachments,
      });

      await clearTodoCache();

      res.status(201).json(todo);
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   PUT /api/todos/:id
========================= */

app.put("/api/todos/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid todo ID",
      });
    }

    const allowedFields = [
      "title",
      "description",
      "completed",
      "priority",
      "dueDate",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (
      updates.priority !== undefined &&
      !["low", "medium", "high"].includes(updates.priority)
    ) {
      return res.status(400).json({
        message: "Invalid priority",
      });
    }

    const todo = await Todo.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!todo) {
      return res.status(404).json({
        message: "Todo not found",
      });
    }

    await clearTodoCache();

    res.json(todo);
  } catch (error) {
    next(error);
  }
});

/* =========================
   DELETE /api/todos/:id
========================= */

app.delete("/api/todos/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid todo ID",
      });
    }

    const todo = await Todo.findByIdAndDelete(id);

    if (!todo) {
      return res.status(404).json({
        message: "Todo not found",
      });
    }

    for (const attachment of todo.attachments || []) {
      if (!attachment.filename) {
        continue;
      }

      const filePath = path.join(UPLOAD_DIR, attachment.filename);

      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error("File delete error:", error.message);
      }
    }

    await clearTodoCache();

    res.json({
      message: "Todo deleted",
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   Analytics
========================= */

app.get("/api/analytics", async (req, res, next) => {
  try {
    if (!ENABLE_ANALYTICS) {
      return res.status(404).json({
        message: "Analytics disabled",
      });
    }

    const [total, completed, pending] = await Promise.all([
      Todo.countDocuments(),
      Todo.countDocuments({ completed: true }),
      Todo.countDocuments({ completed: false }),
    ]);

    const priorities = await Todo.aggregate([
      {
        $group: {
          _id: "$priority",
          count: {
            $sum: 1,
          },
        },
      },
    ]);

    res.json({
      total,
      completed,
      pending,
      priorities,
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   Error handlers
========================= */

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      message: error.message,
    });
  }

  if (error.message === "Unsupported file type") {
    return res.status(400).json({
      message: error.message,
    });
  }

  console.error(error);

  res.status(500).json({
    message: "Internal server error",
  });
});

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

/* =========================
   Database connections
========================= */

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

async function connectMongo() {
  await mongoose.connect(MONGODB_URI);

  mongoConnected = true;

  mongoose.connection.on("disconnected", () => {
    mongoConnected = false;
    console.log("MongoDB disconnected");
  });

  mongoose.connection.on("connected", () => {
    mongoConnected = true;
    console.log("MongoDB connected");
  });

  console.log("MongoDB connected");
}

/* =========================
   Graceful shutdown
========================= */

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  try {
    await mongoose.connection.close();

    if (redisClient.isOpen) {
      await redisClient.quit();
    }

    process.exit(0);
  } catch (error) {
    console.error("Shutdown error:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/* =========================
   Start server
========================= */

async function startServer() {
  try {
    await connectRedis();
    await connectMongo();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
