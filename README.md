# NexTools — Project Management App

Full-stack project management tool built with **Go + React + PostgreSQL**.

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Go 1.26, Gin, GORM, JWT |
| Frontend | React 19, Vite, Tailwind CSS |
| Database | PostgreSQL 16 |
| Infra (prod) | Docker, Nginx, Traefik |

## Local Development

### Prerequisites
- Go 1.26+
- Node.js 18+
- PostgreSQL 16

### 1. Setup Database
```bash
psql postgres -c "CREATE USER authuser WITH PASSWORD 'authpass';"
psql postgres -c "CREATE DATABASE auth_db OWNER authuser;"
```

### 2. Backend
```bash
cd auth-service
cp .env.example .env   # edit if needed
go run cmd/main.go
# → http://localhost:8090
```

### 3. Frontend
```bash
cd auth-client
npm install
npm run dev
# → http://localhost:5173
```

### Environment Variables (`auth-service/.env`)
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=authuser
DB_PASSWORD=authpass
DB_NAME=auth_db

JWT_SECRET=super-secret-jwt-key-change-in-production
JWT_EXPIRY_HOURS=24

SERVER_PORT=8090
```

---

## Deployment (VPS / Ubuntu)

### Option A — Docker Compose (Recommended)

**1. SSH into your VPS**
```bash
ssh user@your-server-ip
```

**2. Install Docker**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

**3. Clone repo**
```bash
git clone https://github.com/imam-nurokhi/nextools-prod.git
cd nextools-prod
```

**4. Create `.env` file**
```bash
cat > auth-service/.env << EOF
DB_HOST=nextools-db
DB_PORT=5432
DB_USER=authuser
DB_PASSWORD=your-secure-password
DB_NAME=auth_db
JWT_SECRET=your-very-secure-jwt-secret-here
JWT_EXPIRY_HOURS=24
SERVER_PORT=8090
EOF
```

**5. Build frontend**
```bash
cd auth-client
npm install
VITE_API_URL=https://your-api-domain.com/api npm run build
cd ..
```

**6. Create Docker network & start**
```bash
docker network create web
docker compose up -d
```

**7. Verify**
```bash
docker ps
curl http://localhost:8090/health
```

---

### Option B — Manual (No Docker)

**Backend**
```bash
# Install Go
wget https://go.dev/dl/go1.26.2.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.26.2.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# Build binary
cd auth-service
go build -o nextools-backend cmd/main.go

# Run as service
sudo tee /etc/systemd/system/nextools-backend.service > /dev/null << EOF
[Unit]
Description=NexTools Backend
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/nextools-prod/auth-service
ExecStart=/home/ubuntu/nextools-prod/auth-service/nextools-backend
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable nextools-backend
sudo systemctl start nextools-backend
```

**Frontend (Nginx)**
```bash
# Build
cd auth-client
VITE_API_URL=https://your-api-domain.com/api npm run build

# Copy to nginx
sudo cp -r dist/* /var/www/html/nextools/

# Nginx config
sudo tee /etc/nginx/sites-available/nextools << EOF
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/html/nextools;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8090;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/nextools /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

### Option C — Deploy Frontend to Vercel (Easiest)

```bash
npm install -g vercel
cd auth-client
vercel
# Set environment variable in Vercel dashboard:
# VITE_API_URL = https://your-backend-url.com/api
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register user |
| POST | `/api/auth/login` | ❌ | Login → JWT token |
| GET | `/api/auth/me` | ✅ | Current user |
| GET | `/api/projects` | ✅ | List projects |
| POST | `/api/projects` | ✅ | Create project |
| GET | `/api/projects/:id/tasks` | ✅ | List tasks |
| POST | `/api/projects/:id/tasks` | ✅ | Create task |
| PUT | `/api/tasks/:id` | ✅ | Update task |
| GET | `/health` | ❌ | Health check |

## License
MIT
