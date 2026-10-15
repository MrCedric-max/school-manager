# School Manager — production image (API + interface on one port).
#   docker build -t school-manager .
#   docker run -p 4000:4000 -v school-data:/data school-manager

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund
COPY client ./client
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=4000 HOST=0.0.0.0 DATA_DIR=/data
COPY package.json package-lock.json .npmrc ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace=server --include-workspace-root=false --no-audit --no-fund
COPY server ./server
COPY --from=build /app/client/dist ./client/dist
VOLUME /data
EXPOSE 4000
CMD ["node", "server/src/index.js"]
