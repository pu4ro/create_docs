#!/bin/bash

# Python 버전별 설치 스크립트
# Korean Interior Estimate Web Application - Python Version Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="estimate-webapp"
APP_DIR="$(pwd)"
REQUIRED_PYTHON_MIN="3.8"
RECOMMENDED_PYTHON="3.10.12"

echo -e "${GREEN}=== Python 버전별 환경 설치 스크립트 ===${NC}"
echo -e "${BLUE}현재 디렉토리: $APP_DIR${NC}"
echo

# Function to compare version numbers
version_compare() {
    local version1=$1
    local version2=$2
    
    if [[ "$(printf '%s\n' "$version1" "$version2" | sort -V | head -n1)" = "$version1" ]]; then 
        if [[ "$version1" != "$version2" ]]; then
            return 1  # version1 < version2
        else
            return 0  # version1 = version2
        fi
    else
        return 2  # version1 > version2
    fi
}

# Check current Python version
echo -e "${YELLOW}Python 버전 확인 중...${NC}"

if command -v python3 &> /dev/null; then
    CURRENT_PYTHON=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')")
    CURRENT_MAJOR_MINOR=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    echo -e "${GREEN}✓ 현재 Python 버전: $CURRENT_PYTHON${NC}"
    
    # Check minimum version requirement
    version_compare $CURRENT_MAJOR_MINOR $REQUIRED_PYTHON_MIN
    case $? in
        1)
            echo -e "${RED}❌ Python 버전이 너무 낮습니다. 최소 요구 버전: $REQUIRED_PYTHON_MIN${NC}"
            echo -e "${YELLOW}Python $REQUIRED_PYTHON_MIN 이상을 설치해주세요.${NC}"
            exit 1
            ;;
        0|2)
            echo -e "${GREEN}✓ Python 버전이 호환됩니다 (최소 요구: $REQUIRED_PYTHON_MIN)${NC}"
            ;;
    esac
else
    echo -e "${RED}❌ Python3이 설치되어 있지 않습니다.${NC}"
    echo -e "${YELLOW}Python $REQUIRED_PYTHON_MIN 이상을 설치해주세요.${NC}"
    exit 1
fi

# Create runtime files
echo -e "${YELLOW}런타임 환경 파일 생성 중...${NC}"
echo "python-$CURRENT_PYTHON" > runtime.txt
echo "$CURRENT_PYTHON" > .python-version

# Python environment setup
echo -e "${YELLOW}Python 가상환경 설정 중...${NC}"

# Remove existing venv if it exists
if [ -d "venv" ]; then
    echo -e "${YELLOW}기존 가상환경을 제거합니다...${NC}"
    rm -rf venv
fi

# Create new virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
echo -e "${YELLOW}pip 업그레이드 중...${NC}"
pip install --upgrade pip

# Check pip version
PIP_VERSION=$(pip --version | cut -d' ' -f2)
echo -e "${GREEN}✓ pip 버전: $PIP_VERSION${NC}"

# Install dependencies based on Python version
echo -e "${YELLOW}Python 버전별 의존성 설치 중...${NC}"

# Create version-specific requirements if needed
case $CURRENT_MAJOR_MINOR in
    "3.8")
        echo -e "${BLUE}Python 3.8 환경을 위한 최적화된 패키지 설치${NC}"
        pip install "numpy>=1.19.0,<1.25.0" "pandas>=1.3.0,<2.1.0"
        ;;
    "3.9")
        echo -e "${BLUE}Python 3.9 환경을 위한 최적화된 패키지 설치${NC}"
        pip install "numpy>=1.20.0,<1.26.0" "pandas>=1.4.0,<2.2.0"
        ;;
    "3.10")
        echo -e "${BLUE}Python 3.10 환경을 위한 최적화된 패키지 설치 (권장)${NC}"
        ;;
    "3.11")
        echo -e "${BLUE}Python 3.11 환경을 위한 최적화된 패키지 설치${NC}"
        ;;
    "3.12")
        echo -e "${BLUE}Python 3.12 환경을 위한 최적화된 패키지 설치${NC}"
        ;;
    *)
        echo -e "${YELLOW}표준 패키지 버전으로 설치합니다${NC}"
        ;;
esac

# Install main requirements
pip install -r requirements.txt

# Verify installation
echo -e "${YELLOW}설치 검증 중...${NC}"
python3 -c "
try:
    import flask
    import pandas
    import openpyxl
    import flask_cors
    print('✓ 모든 필수 패키지가 성공적으로 설치되었습니다')
except ImportError as e:
    print(f'❌ 패키지 설치 실패: {e}')
    exit(1)
"

# Generate environment info
echo -e "${YELLOW}환경 정보 파일 생성 중...${NC}"
cat > environment-info.txt << EOF
# Python 환경 정보
Python 버전: $CURRENT_PYTHON
설치 일시: $(date)
운영체제: $(uname -a)
가상환경 경로: $(pwd)/venv

# 설치된 패키지 버전
$(pip freeze)
EOF

# Create start script for this Python version
cat > start-app.sh << EOF
#!/bin/bash
# $APP_NAME 시작 스크립트 (Python $CURRENT_PYTHON)

cd "\$(dirname "\$0")"
source venv/bin/activate

echo "Starting $APP_NAME with Python $CURRENT_PYTHON..."
python3 app.py
EOF

chmod +x start-app.sh

# Create production start script
cat > start-production.sh << EOF
#!/bin/bash
# $APP_NAME 프로덕션 시작 스크립트 (Python $CURRENT_PYTHON)

cd "\$(dirname "\$0")"
source venv/bin/activate

# 환경 변수 설정
export SECRET_KEY=\${SECRET_KEY:-\$(python3 -c "import secrets; print(secrets.token_hex(32))")}
export FLASK_ENV=production

echo "Starting $APP_NAME in production mode with Python $CURRENT_PYTHON..."
gunicorn -c gunicorn.conf.py app:app
EOF

chmod +x start-production.sh

echo
echo -e "${GREEN}=== 설치 완료 ===${NC}"
echo -e "${GREEN}Python 버전: $CURRENT_PYTHON${NC}"
echo -e "${GREEN}가상환경: $(pwd)/venv${NC}"
echo -e "${GREEN}런타임 파일: runtime.txt, .python-version${NC}"
echo
echo -e "${BLUE}사용 가능한 명령어:${NC}"
echo "  개발 모드 실행:     ./start-app.sh"
echo "  프로덕션 모드 실행: ./start-production.sh"
echo "  가상환경 활성화:    source venv/bin/activate"
echo
echo -e "${BLUE}환경 정보:${NC}"
echo "  환경 정보 파일:     environment-info.txt"
echo "  Python 경로:        $(which python3)"
echo "  pip 경로:          $(which pip)"
echo
echo -e "${GREEN}✅ Python $CURRENT_PYTHON 환경에서 성공적으로 설치되었습니다!${NC}"