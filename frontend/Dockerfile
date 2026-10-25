# --- Build stage: compile the React app ------------------------------------------------------------
FROM node:22.23.4 AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --progress=false

COPY . .

# Refuse to build with a secrets file in the sources (see .dockerignore).
RUN found="$(find /app -path /app/node_modules -prune -o \( -name .env -o -name '.env.*' -o -name '*.env' \) -print)"; \
    if [ -n "$found" ]; then echo "Secret file(s) copied into the image: $found" >&2; exit 1; fi

RUN npm run build

# --- Runtime stage: nginx serves the build and proxies the backend ---------------------------------
FROM nginx:1.29-alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
