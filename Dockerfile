# Use Node.js 20 official image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including dev (skip prepare script to avoid husky)
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port (Railway will override this with PORT env var)
EXPOSE 3000

# Start the application
CMD ["npm", "run", "server"]
