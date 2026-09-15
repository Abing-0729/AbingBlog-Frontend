FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# 生产构建关闭 mock，走真实后端接口
ARG VITE_USE_MOCK=false
ENV VITE_USE_MOCK=$VITE_USE_MOCK
RUN npm run build

FROM nginx:1.27-alpine
# 放进 templates 目录，容器启动时 envsubst 会用 BACKEND_ORIGIN 渲染成 conf.d/default.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# 后端地址默认值，部署时可通过环境变量覆盖
ENV BACKEND_ORIGIN=http://backend:8080
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -q -O - http://127.0.0.1/healthz || exit 1
