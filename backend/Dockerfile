# Stage 1: install production dependencies
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

# Stage 2: production image
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

RUN mkdir -p /app/uploads /app/logs && chown -R nodeuser:nodejs /app

USER nodeuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "src/app.js"]
