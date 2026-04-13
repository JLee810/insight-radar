FROM node:22-slim

# Install build tools needed for better-sqlite3 native bindings
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies (compiles native modules)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Ensure data directory exists for SQLite volume
RUN mkdir -p /data

EXPOSE 3001

CMD ["node", "index.js"]
