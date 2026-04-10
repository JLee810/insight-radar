FROM node:22-alpine

# Build tools needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy and install dependencies first (layer cache friendly)
COPY server/package.json ./
RUN npm install

# Copy server source
COPY server/ .

EXPOSE 3001

CMD ["node", "index.js"]
