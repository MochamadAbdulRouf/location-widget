# How can I edit this code?

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

# 🐳 Docker Multi-Stage Build

This project uses a **multi-stage Docker build** to produce a lean, secure, and optimized
production image for a **React (Vite)** application.

---

## 📋 Overview

| Stage   | Name      | Base Image             | Purpose                           |
| ------- | --------- | ---------------------- | --------------------------------- |
| Stage 1 | `builder` | `node:${NODE_VERSION}` | Build & compile the React app     |
| Stage 2 | `runner`  | `node:${NODE_VERSION}` | Serve the static production build |

---

## 🔨 Stage 1 — Builder

> Installs dependencies and compiles the React (Vite) app into optimized static files.

| Instruction                              | Description                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `FROM node:${NODE_VERSION} AS builder`   | Uses a lightweight Node.js 24 Alpine image as the build environment       |
| `COPY package.json package-lock.json ./` | Copies dependency manifests first to leverage Docker layer caching        |
| `RUN npm ci`                             | Installs dependencies cleanly and reproducibly based on the lockfile      |
| `COPY . .`                               | Copies the full application source code into the container                |
| `RUN npm run build`                      | Compiles the app into optimized static files inside the `dist/` directory |

---

## 🚀 Stage 2 — Runner

> Serves the production build in a minimal and hardened runtime environment.

| Instruction                                        | Description                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `FROM node:${NODE_VERSION} AS runner`              | Starts a fresh Node.js 24 Alpine image — no leftover build artifacts               |
| `ENV NODE_ENV=production`                          | Ensures Node.js runs in production mode                                            |
| `WORKDIR /app`                                     | Sets `/app` as the working directory inside the container                          |
| `COPY --from=builder /app/dist ./dist`             | Copies only the compiled static files from the builder stage                       |
| `RUN npm install serve@^14.2.6 --omit=dev`         | Installs the pinned `serve` package only — no global install, no dev dependencies  |
| `USER node`                                        | Drops root privileges following container security best practices                  |
| `EXPOSE 3000`                                      | Declares port `3000` as the application's listening port                           |
| `CMD ["npx", "serve", "-s", "dist", "-l", "3000"]` | Starts `serve` to host the static build on port `3000`                             |

---

## ✅ Benefits

| Benefit                     | Details                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| 📦 **Smaller image size**   | Final image contains only the production build and `serve` — no Node modules or build tools  |
| 🔒 **Enhanced security**    | Dev dependencies excluded; app runs as non-root `node` user                                  |
| ⚡ **Better performance**   | `serve` efficiently delivers static files with minimal runtime overhead                      |
