# 🚀 프로덕션 환경 설정 가이드

이 가이드는 인테리어 견적서 & 영수증 기록 생성기를 프로덕션 환경에 안전하게 배포하는 방법을 제공합니다.

## 📋 사전 준비사항

### 1. 시스템 요구사항
- Ubuntu 20.04 LTS 이상
- Python 3.8 이상
- 최소 2GB RAM, 20GB 저장공간
- 방화벽에서 포트 5002 열림

### 2. 필수 패키지 설치
```bash
sudo apt update
sudo apt install python3-pip python3-venv nginx supervisor
```

## 🔒 보안 설정

### 1. 환경 변수 설정
프로덕션 환경에서는 반드시 보안 키를 환경 변수로 설정해야 합니다.

```bash
# /etc/environment 파일에 추가
sudo tee -a /etc/environment << EOF
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
EOF

# 환경 변수 즉시 적용
source /etc/environment
```

### 2. 데이터베이스 백업 스크립트
```bash
#!/bin/bash
# backup.sh
DATE=$(date +"%Y%m%d_%H%M%S")
cp /path/to/your/app/estimate.db "/backup/estimate_$DATE.db"
find /backup -name "estimate_*.db" -mtime +7 -delete
```

## ⚙️ WSGI 서버 설정 (Gunicorn)

### 1. Gunicorn 설정 파일 생성
`gunicorn.conf.py`:
```python
bind = "0.0.0.0:5002"
workers = 4
worker_class = "sync"
timeout = 30
keepalive = 2
preload_app = True
max_requests = 1000
max_requests_jitter = 50

# 로그 설정
accesslog = "/var/log/estimate-app/access.log"
errorlog = "/var/log/estimate-app/error.log"
loglevel = "info"
```

### 2. 로그 디렉토리 생성
```bash
sudo mkdir -p /var/log/estimate-app
sudo chown $USER:$USER /var/log/estimate-app
```

### 3. Gunicorn 실행
```bash
gunicorn -c gunicorn.conf.py app:app
```

## 🔧 Systemd 서비스 설정

### 1. 기존 서비스 파일 업데이트
`/etc/systemd/system/estimate-webapp.service`:
```ini
[Unit]
Description=Interior Estimate Web Application
After=network.target

[Service]
Type=exec
User=root
WorkingDirectory=/root/make_Proposal
Environment=SECRET_KEY=your_generated_secret_key_here
Environment=FLASK_ENV=production
ExecStart=/root/make_Proposal/venv/bin/gunicorn -c gunicorn.conf.py app:app
Restart=always
RestartSec=10

# 보안 설정
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/root/make_Proposal
ProtectHome=yes

[Install]
WantedBy=multi-user.target
```

### 2. 서비스 등록 및 시작
```bash
sudo systemctl daemon-reload
sudo systemctl enable estimate-webapp
sudo systemctl start estimate-webapp
sudo systemctl status estimate-webapp
```

## 🌐 Nginx 리버스 프록시 설정 (선택사항)

### 1. Nginx 설정
`/etc/nginx/sites-available/estimate-app`:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 실제 도메인으로 변경
    
    location / {
        proxy_pass http://127.0.0.1:5002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /static {
        alias /root/make_Proposal/static;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 2. 설정 활성화
```bash
sudo ln -s /etc/nginx/sites-available/estimate-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 📊 모니터링 및 로그

### 1. 로그 로테이션 설정
`/etc/logrotate.d/estimate-app`:
```
/var/log/estimate-app/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        systemctl reload estimate-webapp
    endscript
}
```

### 2. 시스템 모니터링
```bash
# 애플리케이션 상태 확인
sudo systemctl status estimate-webapp

# 실시간 로그 확인
sudo journalctl -u estimate-webapp -f

# 애플리케이션 로그 확인
tail -f /var/log/estimate-app/error.log
tail -f /var/log/estimate-app/access.log
```

## 🔧 성능 최적화

### 1. 데이터베이스 최적화
```sql
-- SQLite 최적화 설정
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;
```

### 2. 정적 파일 최적화
```bash
# 정적 파일 압축
sudo apt install brotli
find static/ -type f \( -name "*.js" -o -name "*.css" \) -exec brotli {} \;
```

## 🛡️ SSL/TLS 설정 (HTTPS)

### 1. Let's Encrypt 인증서 설치
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 2. 자동 갱신 설정
```bash
sudo crontab -e
# 다음 줄 추가:
0 12 * * * /usr/bin/certbot renew --quiet
```

## 📦 배포 스크립트

### deploy.sh
```bash
#!/bin/bash
set -e

echo "🚀 프로덕션 배포 시작..."

# 백업
echo "📦 데이터베이스 백업..."
./backup.sh

# 코드 업데이트
echo "💾 코드 업데이트..."
git pull origin main

# 의존성 설치
echo "📚 의존성 업데이트..."
source venv/bin/activate
pip install -r requirements.txt

# 서비스 재시작
echo "🔄 서비스 재시작..."
sudo systemctl restart estimate-webapp

# 상태 확인
echo "✅ 서비스 상태 확인..."
sleep 5
sudo systemctl status estimate-webapp --no-pager

echo "🎉 배포 완료!"
```

## 🔍 트러블슈팅

### 일반적인 문제들

1. **서비스가 시작되지 않음**
   ```bash
   sudo journalctl -u estimate-webapp --no-pager
   ```

2. **포트가 이미 사용 중**
   ```bash
   sudo lsof -i :5002
   sudo kill -9 <PID>
   ```

3. **데이터베이스 권한 문제**
   ```bash
   sudo chown -R $USER:$USER /root/make_Proposal/
   sudo chmod 644 estimate.db
   ```

4. **메모리 부족**
   - Gunicorn workers 수 감소
   - swap 메모리 추가

### 성능 모니터링
```bash
# CPU 및 메모리 사용량 확인
htop

# 디스크 사용량 확인
df -h

# 네트워크 연결 상태
netstat -tlnp | grep :5002
```

## 📞 지원 및 문의

문제가 발생하거나 추가 지원이 필요한 경우:
- 시스템 로그: `sudo journalctl -u estimate-webapp -f`
- 애플리케이션 로그: `/var/log/estimate-app/`
- 설정 파일 확인: `estimate-webapp.service`, `gunicorn.conf.py`

---

**⚠️ 중요 알림**: 프로덕션 환경에서는 반드시 정기적인 백업과 모니터링을 수행하세요.