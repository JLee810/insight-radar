FROM node:22-slim

# Build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for layer caching
COPY server/package.json server/package-lock.json* ./

# Install dependencies (ci = clean install from lockfile if present)
RUN npm ci --ignore-scripts || npm install --ignore-scripts

# Rebuild native modules for this platform
RUN npm rebuild better-sqlite3

# Copy all server source files
COPY server/ .

EXPOSE 3001

CMD ["node", "index.js"]
