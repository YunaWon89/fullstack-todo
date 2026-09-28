# Full-Stack TODO Application

A full-stack TODO application built with React, Node.js, Express, MongoDB, Redis, Docker and Nginx.

## Features

* Create TODO tasks
* View all tasks
* Mark tasks as completed
* Delete tasks
* Set task priority
* Set due dates
* REST API
* MongoDB data persistence
* Redis caching
* File upload support
* Health check endpoint
* Nginx reverse proxy
* Dockerized development and production setup

## Tech Stack

### Frontend

* React
* Vite
* Axios
* Nginx

### Backend

* Node.js
* Express
* Mongoose
* Redis
* Multer
* Helmet
* CORS
* Express Rate Limit

### Infrastructure

* Docker
* Docker Compose
* MongoDB
* Redis
* Nginx

## Project Structure

```text
fullstack-todo/
├── backend/
│   ├── src/
│   │   └── app.js
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   ├── nginx.conf
│   └── nginx-ssl.conf
├── docker-compose.yml
├── docker-compose.prod.yml
├── docker-compose.monitoring.yml
├── mongo-init.js
├── .env.example
└── README.md
```

## Requirements

* Docker Desktop
* Git

## Run with Docker

Clone the repository:

```bash
git clone https://github.com/YunaWon89/fullstack-todo.git
cd fullstack-todo
```

Start all services:

```bash
docker compose up -d --build
```

Check running containers:

```bash
docker compose ps
```

The application will be available at:

```text
http://localhost
```

## Services

| Service  |  Port | Description                            |
| -------- | ----: | -------------------------------------- |
| Nginx    |    80 | Reverse proxy and frontend entry point |
| Backend  |  3000 | Express REST API                       |
| MongoDB  | 27017 | Database                               |
| Redis    |  6379 | Cache                                  |
| Frontend |    80 | React application                      |

The frontend is accessed through Nginx at port `80`.

## API

Base API URL:

```text
http://localhost/api/todos
```

### Get all TODOs

```http
GET /api/todos
```

### Create a TODO

```http
POST /api/todos
```

Example:

```json
{
  "title": "Learn Docker",
  "description": "Practice Docker Compose",
  "priority": "medium"
}
```

### Update a TODO

```http
PUT /api/todos/:id
```

### Delete a TODO

```http
DELETE /api/todos/:id
```

## Health Check

The application provides a health endpoint:

```text
http://localhost/health
```

It checks the backend, MongoDB and Redis connections.

A healthy response includes:

```json
{
  "status": "healthy",
  "mongo": "connected",
  "redis": "connected"
}
```

## Environment Variables

Example configuration is provided in:

```text
.env.example
```

Production environment variables are kept locally and are not committed to Git.

## Docker Architecture

```text
                    Browser
                       |
                       v
                  Nginx :80
                  /         \
                 /           \
                v             v
          React Frontend    Express API
                              |
                         +----+----+
                         |         |
                         v         v
                      MongoDB    Redis
```

Nginx acts as the single entry point for the application.

* `/` → React frontend
* `/api/` → Express backend
* `/health` → Backend health check
* `/uploads/` → Backend uploads

## Useful Commands

Start:

```bash
docker compose up -d
```

Rebuild:

```bash
docker compose up -d --build
```

Stop:

```bash
docker compose down
```

View logs:

```bash
docker compose logs -f
```

View backend logs:

```bash
docker compose logs -f backend
```

Check containers:

```bash
docker compose ps
```

## Project Status

The application has been tested with Docker Compose.

Verified functionality includes:

* Frontend loading
* Backend API
* MongoDB connection
* Redis connection
* TODO creation
* TODO update
* TODO deletion
* TODO persistence
* Nginx reverse proxy
* Health check
* Production frontend build
