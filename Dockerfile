FROM node:22-slim

# Build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install dependencies first (layer cache friendly)
COPY server/package.json ./
RUN npm install

# Copy server source
COPY server/ .

# Railway injects PORT at runtime — do not hardcode EXPOSE
CMD ["node", "index.js"]
