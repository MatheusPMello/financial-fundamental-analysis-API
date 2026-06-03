# ----------------------------
# STAGE 1: The Builder
# ----------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ----------------------------
# STAGE 2: The Production Runner
# ----------------------------
FROM node:22-alpine AS runner
WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node package*.json ./
RUN npm ci --only=production
COPY --chown=node:node --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]