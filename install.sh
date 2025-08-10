#!/bin/bash

# Korean Interior Estimate Web Application Installer
# 한국 인테리어 견적서 웹 애플리케이션 설치 스크립트

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="estimate-webapp"
SERVICE_NAME="$APP_NAME.service"
APP_PORT="5002"

echo -e "${GREEN}=== 한국 인테리어 견적서 & 영수증 웹 애플리케이션 설치 스크립트 ===${NC}"
echo -e "${BLUE}Korean Interior Estimate Web Application Installer${NC}"
echo

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: 이 스크립트는 root 권한으로 실행해야 합니다${NC}"
   echo "다음과 같이 실행하세요: sudo ./install.sh"
   exit 1
fi

# Get current directory
CURRENT_DIR=$(pwd)
echo -e "${BLUE}설치 디렉토리: ${CURRENT_DIR}${NC}"

# Install system dependencies
echo -e "${YELLOW}[1/7] 시스템 의존성 설치 중...${NC}"
apt-get update -qq
apt-get install -y python3 python3-pip python3-venv systemd curl

# Remove unnecessary files
echo -e "${YELLOW}[2/7] 불필요한 파일 정리 중...${NC}"
rm -f Dockerfile docker-compose.yml docker-deploy.sh pyproject.toml runtime.txt
rm -f install-python-version.sh test-install.sh
rm -rf test_env backups data logs
rm -f DEPLOYMENT_VERSION_GUIDE.md PRODUCTION_SETUP.md QA_REPORT.md
rm -f qa_test_daily.xlsx qa_test_estimate.xlsx

# Stop existing service if running
echo -e "${YELLOW}[3/7] 기존 서비스 중지 중...${NC}"
systemctl stop $SERVICE_NAME 2>/dev/null || true

# Create virtual environment
echo -e "${YELLOW}[4/7] Python 가상환경 설정 중...${NC}"
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo -e "${YELLOW}[5/7] Python 의존성 설치 중...${NC}"
pip install --upgrade pip
pip install -r requirements.txt

# Update systemd service file with current directory
echo -e "${YELLOW}[6/7] Systemd 서비스 설정 중...${NC}"
# Update service file with current directory paths
sed -i "s|WorkingDirectory=.*|WorkingDirectory=${CURRENT_DIR}|g" $SERVICE_NAME
sed -i "s|ExecStart=.*|ExecStart=${CURRENT_DIR}/venv/bin/python app.py|g" $SERVICE_NAME
sed -i "s|ReadWritePaths=.*|ReadWritePaths=${CURRENT_DIR}|g" $SERVICE_NAME

# Install systemd service
cp $SERVICE_NAME /etc/systemd/system/
systemctl daemon-reload
systemctl enable $SERVICE_NAME

# Start the service
echo -e "${YELLOW}[7/7] 서비스 시작 중...${NC}"
systemctl start $SERVICE_NAME

# Check service status
sleep 5
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}✓ 서비스가 성공적으로 시작되었습니다!${NC}"
else
    echo -e "${RED}✗ 서비스 시작에 실패했습니다. 로그를 확인하세요: journalctl -u $SERVICE_NAME${NC}"
    exit 1
fi

# Test web connectivity
echo -e "${YELLOW}웹 서버 연결 테스트 중...${NC}"
sleep 2
if curl -s http://localhost:$APP_PORT >/dev/null; then
    echo -e "${GREEN}✓ 웹 서버가 정상적으로 작동하고 있습니다!${NC}"
else
    echo -e "${RED}⚠ 웹 서버 연결에 문제가 있을 수 있습니다${NC}"
fi

echo
echo -e "${GREEN}===================================================${NC}"
echo -e "${GREEN}         🎉 설치가 완료되었습니다! 🎉         ${NC}"
echo -e "${GREEN}===================================================${NC}"
echo
echo -e "${GREEN}📍 접속 주소:${NC}"
echo -e "   로컬: ${BLUE}http://localhost:${APP_PORT}${NC}"
echo -e "   외부: ${BLUE}http://$(hostname -I | awk '{print $1}'):${APP_PORT}${NC}"
echo
echo -e "${GREEN}🔧 서비스 관리 명령어:${NC}"
echo -e "   시작:    ${YELLOW}systemctl start $SERVICE_NAME${NC}"
echo -e "   중지:    ${YELLOW}systemctl stop $SERVICE_NAME${NC}"
echo -e "   재시작:  ${YELLOW}systemctl restart $SERVICE_NAME${NC}"
echo -e "   상태:    ${YELLOW}systemctl status $SERVICE_NAME${NC}"
echo -e "   로그:    ${YELLOW}journalctl -u $SERVICE_NAME -f${NC}"
echo
echo -e "${GREEN}📂 설치 디렉토리:${NC} ${CURRENT_DIR}"
echo -e "${GREEN}🗄️  데이터베이스:${NC} ${CURRENT_DIR}/estimate.db"
echo -e "${GREEN}📋 로그 파일:${NC} ${CURRENT_DIR}/app.log"
echo
echo -e "${GREEN}✨ 기능:${NC}"
echo -e "   • 인테리어 견적서 생성 및 PDF 다운로드"
echo -e "   • 일일 영수증 기록 관리"
echo -e "   • 회사/고객/계좌 정보 데이터베이스 관리"
echo -e "   • A4 반응형 견적서 템플릿"
echo -e "   • Excel 파일 내보내기"
echo
echo -e "${BLUE}💡 Tips:${NC}"
echo -e "   • 방화벽 설정이 필요한 경우 포트 ${APP_PORT}을 열어주세요"
echo -e "   • 부팅 시 자동 시작하도록 설정되어 있습니다"
echo -e "   • 문제 발생 시 로그를 확인해주세요"
echo

# Show final status
echo -e "${YELLOW}📊 최종 상태 확인:${NC}"
systemctl status $SERVICE_NAME --no-pager -l