FROM node:20-alpine AS build
WORKDIR /app/frontend

ARG VITE_APP_BASE_PATH=/nav/
ARG VITE_SESSION_STORAGE_KEY=nav.guide.session.v1
ARG VITE_CONTENT_DRAFT_STORAGE_KEY=nav.content.draft.v1
ENV VITE_APP_BASE_PATH=${VITE_APP_BASE_PATH}
ENV VITE_SESSION_STORAGE_KEY=${VITE_SESSION_STORAGE_KEY}
ENV VITE_CONTENT_DRAFT_STORAGE_KEY=${VITE_CONTENT_DRAFT_STORAGE_KEY}

COPY frontend/package.json ./
RUN npm install --no-audit --no-fund

COPY frontend ./
RUN npm run build

FROM nginx:1.27-alpine
COPY infra/nginx/nav.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html/nav

EXPOSE 8080
