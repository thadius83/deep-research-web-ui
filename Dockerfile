# Build stage
FROM node:20-slim AS builder

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml ./

# Install all dependencies for build
RUN pnpm install

# Copy source files and env files
COPY . .

# Build arguments
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Build application
RUN pnpm build

# Production stage
FROM node:20-slim AS production

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod

# Copy built application from builder
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/.env* ./

# Runtime environment variables
ENV NODE_ENV=production \
    NUXT_HOST=0.0.0.0 \
    NUXT_PORT=3000

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", ".output/server/index.mjs"]
