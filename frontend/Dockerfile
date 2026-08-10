FROM node:20-alpine AS build

WORKDIR /app

# VITE_API_URL is baked in at build time. Leave empty to serve the app and
# API from the same origin (nginx proxies /api and /uploads to the backend).
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
