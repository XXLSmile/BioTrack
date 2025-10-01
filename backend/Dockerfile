# ---- Builder ----
FROM node:20.6-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build        # produces /app/dist

# ---- Runtime ----
FROM node:20.6-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# Optional: if you rely on PORT at runtime
ARG PORT
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD ["node", "dist/index.js"]
