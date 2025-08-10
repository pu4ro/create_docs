#!/bin/bash

# Docker 배포 스크립트 - Python 버전별 지원
# Korean Interior Estimate Web Application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_NAME="interior-estimate-webapp"
DOCKER_IMAGE_NAME="estimate-webapp"
PYTHON_VERSION=$(cat runtime.txt | cut -d'-' -f2)

echo -e "${GREEN}=== Docker 배포 스크립트 ===${NC}"
echo -e "${BLUE}애플리케이션: $APP_NAME${NC}"
echo -e "${BLUE}Python 버전: $PYTHON_VERSION${NC}"
echo

# Function to show usage
show_usage() {
    echo -e "${YELLOW}사용법:${NC}"
    echo "  $0 [dev|prod|build|stop|logs|clean]"
    echo
    echo -e "${YELLOW}명령어:${NC}"
    echo "  dev    - 개발 모드로 실행"
    echo "  prod   - 프로덕션 모드로 실행 (with backup)"
    echo "  build  - Docker 이미지 빌드만 수행"
    echo "  stop   - 모든 컨테이너 중지"
    echo "  logs   - 로그 확인"
    echo "  clean  - 컨테이너 및 볼륨 정리"
    echo
    exit 1
}

# Check if docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker가 설치되어 있지 않습니다.${NC}"
        echo "Docker를 설치한 후 다시 시도해주세요."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose가 설치되어 있지 않습니다.${NC}"
        echo "Docker Compose를 설치한 후 다시 시도해주세요."
        exit 1
    fi
    
    echo -e "${GREEN}✓ Docker 및 Docker Compose 확인 완료${NC}"
}

# Create necessary directories
setup_directories() {
    echo -e "${YELLOW}필요한 디렉토리 생성 중...${NC}"
    mkdir -p data logs backups
    echo -e "${GREEN}✓ 디렉토리 생성 완료${NC}"
}

# Generate secret key if not exists
generate_secret_key() {
    if [ ! -f .env ]; then
        echo -e "${YELLOW}환경 변수 파일 생성 중...${NC}"
        SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
        cat > .env << EOF
# Production Environment Variables
SECRET_KEY=$SECRET_KEY
FLASK_ENV=production
BACKUP_INTERVAL=86400

# Database settings
DATABASE_URL=sqlite:///data/estimate.db

# Logging
LOG_LEVEL=INFO
EOF
        echo -e "${GREEN}✓ .env 파일 생성 완료${NC}"
    else
        echo -e "${GREEN}✓ 기존 .env 파일 사용${NC}"
    fi
}

# Build Docker images
build_images() {
    echo -e "${YELLOW}Docker 이미지 빌드 중...${NC}"
    docker-compose build --no-cache
    echo -e "${GREEN}✓ 이미지 빌드 완료${NC}"
}

# Start development mode
start_dev() {
    echo -e "${YELLOW}개발 모드로 시작 중...${NC}"
    docker-compose --profile dev up -d
    echo -e "${GREEN}✓ 개발 모드 시작 완료${NC}"
    echo -e "${BLUE}접속 URL: http://localhost:5002${NC}"
}

# Start production mode
start_prod() {
    echo -e "${YELLOW}프로덕션 모드로 시작 중...${NC}"
    docker-compose --profile prod up -d
    echo -e "${GREEN}✓ 프로덕션 모드 시작 완료${NC}"
    echo -e "${BLUE}접속 URL: http://localhost:5002${NC}"
}

# Stop all services
stop_services() {
    echo -e "${YELLOW}모든 서비스 중지 중...${NC}"
    docker-compose down
    echo -e "${GREEN}✓ 서비스 중지 완료${NC}"
}

# Show logs
show_logs() {
    echo -e "${YELLOW}로그 확인 중...${NC}"
    docker-compose logs -f
}

# Clean up everything
clean_all() {
    echo -e "${YELLOW}정리 작업 중...${NC}"
    read -p "모든 컨테이너, 이미지, 볼륨을 삭제하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v --rmi all --remove-orphans
        docker system prune -f
        echo -e "${GREEN}✓ 정리 완료${NC}"
    else
        echo -e "${YELLOW}정리 작업이 취소되었습니다.${NC}"
    fi
}

# Show status
show_status() {
    echo -e "${BLUE}=== 컨테이너 상태 ===${NC}"
    docker-compose ps
    echo
    echo -e "${BLUE}=== 이미지 정보 ===${NC}"
    docker images | grep -E "(estimate-webapp|REPOSITORY)"
    echo
    echo -e "${BLUE}=== 볼륨 정보 ===${NC}"
    docker volume ls | grep -E "(estimate|DRIVER)"
}

# Health check
health_check() {
    echo -e "${YELLOW}서비스 상태 확인 중...${NC}"
    sleep 5
    
    if curl -s http://localhost:5002 > /dev/null; then
        echo -e "${GREEN}✓ 애플리케이션이 정상 동작 중입니다${NC}"
    else
        echo -e "${RED}❌ 애플리케이션 접속에 실패했습니다${NC}"
        echo -e "${YELLOW}로그를 확인해보세요: $0 logs${NC}"
    fi
}

# Main script logic
main() {
    case ${1:-help} in
        dev)
            check_docker
            setup_directories
            generate_secret_key
            start_dev
            health_check
            ;;
        prod)
            check_docker
            setup_directories
            generate_secret_key
            start_prod
            health_check
            ;;
        build)
            check_docker
            setup_directories
            build_images
            ;;
        stop)
            stop_services
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        clean)
            clean_all
            ;;
        help|*)
            show_usage
            ;;
    esac
}

# Run main function
main "$@"