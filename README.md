# AbingBlog-Frontend
个人博客前端
## Development

```bash
npm ci
npm run dev
```

## Production CI/CD

`ci.yml` runs the TypeScript/Vite build for pushes and pull requests. `deploy.yml` builds a static Nginx image, publishes it to GHCR, and deploys it to the ECS server over SSH when a `v*.*.*` tag is pushed or the workflow is started manually.

Configure these GitHub Secrets:

```text
DEPLOY_HOST
DEPLOY_USER
DEPLOY_SSH_KEY
FRONTEND_DEPLOY_PATH
```

Configure this repository/environment variable when the API is on another host:

```text
VITE_API_BASE_URL=https://api.example.com/api/v1
```

The server directory must contain `docker-compose.prod.yml`. On the same ECS as the backend, keep the frontend container on `127.0.0.1:8081` and let the host Nginx own ports 80/443 and route `/api/` to the backend.

Example host Nginx configuration:

```nginx
server {
    listen 80;
    server_name example.com;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
