# Deployment

This guide covers a private or public HTTP deployment of `ocular` behind a reverse proxy.

## 1. Build

```bash
git clone https://github.com/xyun1996/ocular.git
cd ocular
npm install
npm run build
```

## 2. Configure HTTP transport

Create `.env` from `.env.example` and configure a vision provider plus MCP authentication:

```env
OCULAR_BASE_URL=https://api.openai.com/v1
OCULAR_API_KEY=your_api_key
OCULAR_MODEL=gpt-4o-mini

MCP_TRANSPORT=http
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PORT=3000
MCP_HTTP_PATH=/mcp
MCP_AUTH_TOKEN=replace_with_a_long_random_token
MCP_AUTH_HEADER=authorization
MCP_AUTH_SCHEME=Bearer

OCULAR_UPLOADS_DIR=.ocular-uploads
OCULAR_UPLOAD_URL_BASE=https://ocular.example.com
```

Use a strong random `MCP_AUTH_TOKEN` and keep it out of version control.

## 3. Start the service

```bash
node dist/index.js
```

For a long-running Linux deployment, a minimal systemd unit can look like:

```ini
[Unit]
Description=ocular MCP server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/ocular
EnvironmentFile=/opt/ocular/.env
ExecStart=/usr/bin/node /opt/ocular/dist/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ocular
sudo systemctl status ocular
```

## 4. Reverse proxy with Nginx

Both the MCP endpoint and upload endpoint need to be proxied.

```nginx
server {
    listen 443 ssl;
    server_name ocular.example.com;

    client_max_body_size 20m;

    location /mcp {
        proxy_pass http://127.0.0.1:3000/mcp;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /upload {
        proxy_pass http://127.0.0.1:3000/upload;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20m;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

Keep `location /upload` without a trailing slash so `PUT /upload` is forwarded directly rather than redirected.

TLS certificate configuration is intentionally omitted here; use the certificate management approach appropriate for your environment.

## 5. Verify the upload path

```bash
curl --request PUT \
  --data-binary @/path/to/image.png \
  "https://ocular.example.com/upload" \
  -H "Content-Type: image/png" \
  -H "Authorization: Bearer your_mcp_auth_token"
```

A successful upload returns JSON containing a `file_id`. Use that id in subsequent MCP vision-tool calls.

## 6. Connect an HTTP MCP client

Example configuration:

```json
{
  "mcpServers": {
    "ocular": {
      "type": "http",
      "url": "https://ocular.example.com/mcp",
      "headers": {
        "Authorization": "Bearer your_mcp_auth_token"
      }
    }
  }
}
```

## Operational notes

- Keep the Node service bound to `127.0.0.1` when a reverse proxy is in front of it.
- Do not expose provider API keys through client configuration when the provider call is made server-side.
- Back up `OCULAR_UPLOADS_DIR` only if persisted uploads are operationally important; otherwise it can be treated as rebuildable data.
- Size `client_max_body_size` together with `OCULAR_MAX_IMAGE_MB` so the proxy and application limits are consistent.
- Review logs for metadata and timing, but avoid adding request-body, token, or image logging.

See [`architecture.md`](architecture.md) for the upload and cache model.
