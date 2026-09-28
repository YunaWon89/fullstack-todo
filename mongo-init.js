db = db.getSiblingDB("todoapp");

db.todos.createIndex({ createdAt: -1 });
db.todos.createIndex({ completed: 1 });
db.todos.createIndex({ priority: 1 });
db.todos.createIndex({ dueDate: 1 });

if (db.todos.countDocuments() === 0) {
    db.todos.insertOne({
        title: "Welcome to Full-Stack TODO",
        description: "Your Dockerized TODO application is ready.",
        completed: false,
        priority: "medium",
        dueDate: null,
        attachments: [],
        createdAt: new Date(),
        updatedAt: new Date()
    });
}

print("MongoDB initialization completed.");
