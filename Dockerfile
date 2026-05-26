# Stage 1: Build frontend + compile server
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build Vite frontend
RUN npm run build

# Compile Express server
RUN npx tsc --project tsconfig.server.json

# Stage 2: Production image
FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy compiled server
COPY --from=builder /app/dist-server/server.js ./server.js

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "server.js"]
