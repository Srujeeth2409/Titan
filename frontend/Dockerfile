
# ---- Dependencies stage ----
FROM node:20-alpine AS deps

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /workspace

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /workspace/node_modules ./node_modules
COPY . .

RUN npm run build

# ---- Production runtime stage ----
FROM node:20-alpine AS runner

WORKDIR /workspace

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /workspace/next.config.js ./
COPY --from=builder --chown=node:node /workspace/public ./public
COPY --from=builder --chown=node:node /workspace/.next ./.next
COPY --from=builder --chown=node:node /workspace/node_modules ./node_modules
COPY --from=builder --chown=node:node /workspace/package.json ./package.json

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
