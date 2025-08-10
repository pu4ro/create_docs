# 멀티스테이지 Docker 빌드 - Python 버전별 지원
FROM python:3.10.12-slim as base

# 메타데이터
LABEL maintainer="Interior Estimate Team"
LABEL version="1.0.0"
LABEL description="Korean Interior Estimate & Receipt Record Generator"

# Python 환경 변수
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 시스템 패키지 업데이트 및 필수 패키지 설치
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리 설정
WORKDIR /app

# Python 의존성 파일들 복사 (캐시 최적화)
COPY requirements.txt pyproject.toml runtime.txt ./
COPY .python-version ./

# Python 의존성 설치
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# 개발 스테이지
FROM base as development

# 개발용 추가 패키지 설치
RUN pip install pytest pytest-cov black flake8

# 애플리케이션 코드 복사
COPY . .

# 개발 포트
EXPOSE 5002

# 개발 모드 실행
CMD ["python", "app.py"]

# 프로덕션 스테이지
FROM base as production

# 비루트 사용자 생성
RUN groupadd -g 1000 appuser && \
    useradd -r -u 1000 -g appuser appuser

# 애플리케이션 코드 복사 (소스코드만)
COPY app.py ./
COPY templates/ ./templates/
COPY static/ ./static/
COPY gunicorn.conf.py ./

# 로그 디렉토리 생성
RUN mkdir -p /var/log/estimate-app && \
    chown -R appuser:appuser /app /var/log/estimate-app

# 비루트 사용자로 전환
USER appuser

# 프로덕션 포트
EXPOSE 5002

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5002/', timeout=5)"

# 프로덕션 모드 실행
CMD ["gunicorn", "-c", "gunicorn.conf.py", "app:app"]