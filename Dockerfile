FROM node:22.11-slim
WORKDIR /app
ENV NODE_OPTIONS=--experimental-sqlite
# SITE_URL 必须在构建期可见：sitemap/canonical/hreflang/RSS 均为静态生成，
# 仅靠 compose environment（运行期）注入会让构建产物残留默认域名。
ARG SITE_URL=https://www.starteday.com
ENV SITE_URL=$SITE_URL
RUN apt-get update -y && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
