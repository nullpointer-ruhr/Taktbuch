# Taktbuch Online: API + Oberfläche in einem Image.
# Bauen:  docker build -t taktbuch .

# 1) Oberfläche für das Build-Ziel "online" erzeugen
FROM python:3.13-slim AS web
WORKDIR /src
COPY VERSION REPO.txt build.py ./
COPY packages/core packages/core
COPY packages/web packages/web
RUN TARGET=online python3 build.py

# 2) Laufzeit-Abhängigkeiten der API
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/api/package.json packages/api/
COPY packages/core/package.json packages/core/
COPY packages/web/package.json packages/web/
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# 3) Laufzeit-Image
FROM node:24-slim
ENV NODE_ENV=production \
    WEB_DIR=/app/dist/online \
    PORT=8080
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY VERSION ./
COPY packages/core packages/core
COPY packages/api packages/api
COPY --from=web /src/dist/online dist/online
# Für /status: Commit und Build-Zeit kommen aus image.yml, die Version aus VERSION.
# Steht am Ende, damit die wechselnden Werte den Layer-Cache davor nicht entwerten.
ARG GIT_SHA=""
ARG BUILD_TIME=""
ENV GIT_SHA=$GIT_SHA BUILD_TIME=$BUILD_TIME
USER 65532:65532
EXPOSE 8080
CMD ["node", "packages/api/src/main.ts"]
