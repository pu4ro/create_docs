# Gunicorn 프로덕션 설정 파일

# 바인딩 설정
bind = "0.0.0.0:5002"

# 워커 설정
workers = 4
worker_class = "sync"
worker_connections = 1000

# 성능 설정
timeout = 30
keepalive = 2
preload_app = True
max_requests = 1000
max_requests_jitter = 50

# 로그 설정
accesslog = "/var/log/estimate-app/access.log"
errorlog = "/var/log/estimate-app/error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# 프로세스 설정
daemon = False
pidfile = "/tmp/gunicorn_estimate.pid"
user = None
group = None
tmp_upload_dir = None

# SSL 설정 (필요시)
# keyfile = "/path/to/keyfile"
# certfile = "/path/to/certfile"

# 보안 설정
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190