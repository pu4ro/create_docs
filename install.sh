#!/bin/bash
# -*- coding: utf-8 -*-
# 인테리어 견적서 & 영수증 기록 생성기 자동 설치 및 실행 스크립트

set -e  # 오류 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 프로젝트 정보
PROJECT_NAME="인테리어 견적서 & 영수증 기록 생성기"
VENV_NAME="venv"
PYTHON_VERSION="3.8"

# 함수: 헤더 출력
print_header() {
    echo -e "${CYAN}================================================================${NC}"
    echo -e "${PURPLE}🏠 ${PROJECT_NAME}${NC}"
    echo -e "${CYAN}================================================================${NC}"
    echo ""
}

# 함수: 진행 상태 출력
print_step() {
    echo -e "${BLUE}[단계 $1]${NC} $2"
}

# 함수: 성공 메시지 출력
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# 함수: 경고 메시지 출력
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 함수: 오류 메시지 출력
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 함수: Python 버전 확인
check_python() {
    print_step "1" "Python 환경 확인 중..."
    
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
        PYTHON_VERSION_INSTALLED=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
        PYTHON_VERSION_INSTALLED=$(python -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    else
        print_error "Python이 설치되어 있지 않습니다."
        echo "Python 3.6 이상을 설치한 후 다시 실행해주세요."
        echo "설치 방법:"
        echo "  - Ubuntu/Debian: sudo apt-get install python3 python3-pip python3-venv"
        echo "  - CentOS/RHEL: sudo yum install python3 python3-pip"
        echo "  - macOS: brew install python3"
        echo "  - Windows: https://www.python.org/downloads/ 에서 다운로드"
        exit 1
    fi
    
    # Python 버전 확인 (3.6 이상 필요)
    if [[ $(echo "$PYTHON_VERSION_INSTALLED >= 3.6" | bc -l 2>/dev/null || echo "0") -eq 0 ]]; then
        # bc가 없는 경우를 위한 대체 방법
        MAJOR=$(echo $PYTHON_VERSION_INSTALLED | cut -d. -f1)
        MINOR=$(echo $PYTHON_VERSION_INSTALLED | cut -d. -f2)
        if [[ $MAJOR -lt 3 ]] || [[ $MAJOR -eq 3 && $MINOR -lt 6 ]]; then
            print_error "Python $PYTHON_VERSION_INSTALLED 버전이 감지되었습니다."
            print_error "Python 3.6 이상이 필요합니다."
            exit 1
        fi
    fi
    
    print_success "Python $PYTHON_VERSION_INSTALLED 감지됨"
}

# 함수: pip 버전 확인 및 업그레이드
check_pip() {
    print_step "2" "pip 환경 확인 중..."
    
    if ! command -v pip3 &> /dev/null && ! command -v pip &> /dev/null; then
        print_error "pip이 설치되어 있지 않습니다."
        echo "pip을 설치한 후 다시 실행해주세요:"
        echo "  - Ubuntu/Debian: sudo apt-get install python3-pip"
        echo "  - CentOS/RHEL: sudo yum install python3-pip"
        echo "  - macOS: python3 -m ensurepip --upgrade"
        exit 1
    fi
    
    print_success "pip 환경 확인 완료"
}

# 함수: 가상환경 생성
create_venv() {
    print_step "3" "Python 가상환경 생성 중..."
    
    # 기존 가상환경이 있으면 삭제 확인
    if [ -d "$VENV_NAME" ]; then
        print_warning "기존 가상환경 '$VENV_NAME'이 발견되었습니다."
        read -p "기존 가상환경을 삭제하고 새로 만들까요? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_step "3.1" "기존 가상환경 삭제 중..."
            rm -rf "$VENV_NAME"
            print_success "기존 가상환경 삭제 완료"
        else
            print_step "3.1" "기존 가상환경 사용"
            print_success "기존 가상환경을 사용합니다"
            return 0
        fi
    fi
    
    # 가상환경 생성
    if ! $PYTHON_CMD -m venv "$VENV_NAME"; then
        print_error "가상환경 생성에 실패했습니다."
        print_warning "python3-venv 패키지가 설치되지 않았을 수 있습니다."
        echo "다음 명령으로 설치 후 다시 시도해주세요:"
        echo "  - Ubuntu/Debian: sudo apt-get install python3-venv"
        exit 1
    fi
    
    print_success "가상환경 '$VENV_NAME' 생성 완료"
}

# 함수: 가상환경 활성화
activate_venv() {
    print_step "4" "가상환경 활성화 중..."
    
    if [ ! -f "$VENV_NAME/bin/activate" ]; then
        print_error "가상환경 활성화 스크립트를 찾을 수 없습니다."
        exit 1
    fi
    
    source "$VENV_NAME/bin/activate"
    print_success "가상환경 활성화 완료"
}

# 함수: pip 업그레이드
upgrade_pip() {
    print_step "5" "pip 업그레이드 중..."
    
    if ! pip install --upgrade pip; then
        print_warning "pip 업그레이드에 실패했지만 계속 진행합니다."
    else
        print_success "pip 업그레이드 완료"
    fi
}

# 함수: 패키지 설치
install_packages() {
    print_step "6" "필요한 패키지 설치 중..."
    
    if [ ! -f "requirements.txt" ]; then
        print_error "requirements.txt 파일을 찾을 수 없습니다."
        echo "다음 내용으로 requirements.txt 파일을 생성합니다:"
        cat > requirements.txt << EOF
Flask==2.3.3
pandas==2.0.3
openpyxl==3.1.2
Werkzeug==2.3.7
numpy==1.24.4
EOF
        print_success "requirements.txt 파일 생성 완료"
    fi
    
    echo "설치할 패키지 목록:"
    cat requirements.txt | sed 's/^/  - /'
    echo ""
    
    if ! pip install -r requirements.txt; then
        print_error "패키지 설치에 실패했습니다."
        echo "네트워크 연결을 확인하거나 다음 명령을 수동으로 실행해보세요:"
        echo "  pip install Flask pandas==2.0.3 openpyxl Werkzeug numpy==1.24.4"
        exit 1
    fi
    
    print_success "모든 패키지 설치 완료"
}

# 함수: 애플리케이션 파일 확인
check_app_files() {
    print_step "7" "애플리케이션 파일 확인 중..."
    
    REQUIRED_FILES=("app.py" "templates/index.html" "static/style.css" "static/script.js")
    MISSING_FILES=()
    
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            MISSING_FILES+=("$file")
        fi
    done
    
    if [ ${#MISSING_FILES[@]} -gt 0 ]; then
        print_error "다음 필수 파일들이 누락되었습니다:"
        for file in "${MISSING_FILES[@]}"; do
            echo "  - $file"
        done
        echo ""
        echo "모든 파일이 올바른 위치에 있는지 확인해주세요."
        exit 1
    fi
    
    print_success "모든 애플리케이션 파일 확인 완료"
}

# 함수: 실행 스크립트 생성
create_run_script() {
    print_step "8" "실행 스크립트 생성 중..."
    
    cat > run_app.sh << 'EOF'
#!/bin/bash
# 인테리어 견적서 애플리케이션 실행 스크립트

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 가상환경 활성화
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ 가상환경 활성화 완료"
else
    echo "❌ 가상환경을 찾을 수 없습니다. install.sh를 먼저 실행해주세요."
    exit 1
fi

# 애플리케이션 실행
echo "🚀 인테리어 견적서 & 영수증 기록 생성기를 시작합니다..."
echo "📝 웹 브라우저에서 http://127.0.0.1:5000 으로 접속하세요"
echo "⛔ 종료하려면 Ctrl+C를 누르세요"
echo "=================================================="

python app.py
EOF

    chmod +x run_app.sh
    print_success "실행 스크립트 (run_app.sh) 생성 완료"
}

# 함수: 바탕화면 바로가기 생성 (선택사항)
create_desktop_shortcut() {
    if command -v xdg-user-dir &> /dev/null; then
        DESKTOP_DIR=$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")
        if [ -d "$DESKTOP_DIR" ]; then
            read -p "바탕화면 바로가기를 생성하시겠습니까? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                CURRENT_DIR=$(pwd)
                cat > "$DESKTOP_DIR/견적서생성기.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=인테리어 견적서 생성기
Comment=인테리어 견적서 및 영수증 기록 생성 도구
Exec=gnome-terminal --working-directory="$CURRENT_DIR" --command="./run_app.sh"
Icon=applications-office
Terminal=false
StartupNotify=true
Categories=Office;
EOF
                chmod +x "$DESKTOP_DIR/견적서생성기.desktop"
                print_success "바탕화면 바로가기 생성 완료"
            fi
        fi
    fi
}

# 함수: 설치 완료 메시지
print_completion() {
    echo ""
    echo -e "${GREEN}================================================================${NC}"
    echo -e "${GREEN}🎉 설치가 성공적으로 완료되었습니다! 🎉${NC}"
    echo -e "${GREEN}================================================================${NC}"
    echo ""
    echo -e "${CYAN}📋 실행 방법:${NC}"
    echo -e "  1. ${YELLOW}./run_app.sh${NC} 또는 ${YELLOW}bash run_app.sh${NC}"
    echo -e "  2. 웹 브라우저에서 ${BLUE}http://127.0.0.1:5000${NC} 접속"
    echo ""
    echo -e "${CYAN}📁 파일 구조:${NC}"
    echo "  📂 venv/                # Python 가상환경"
    echo "  📂 templates/           # HTML 템플릿"
    echo "  📂 static/              # CSS, JS 파일"
    echo "  🐍 app.py              # Flask 애플리케이션"
    echo "  🚀 run_app.sh          # 실행 스크립트"
    echo "  🗄️ estimate.db         # SQLite 데이터베이스 (자동생성)"
    echo ""
    echo -e "${CYAN}💡 도움말:${NC}"
    echo "  - 가상환경 수동 활성화: source venv/bin/activate"
    echo "  - 가상환경 비활성화: deactivate"
    echo "  - 패키지 재설치: ./install.sh"
    echo ""
    
    read -p "지금 바로 애플리케이션을 실행하시겠습니까? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo -e "${BLUE}🚀 애플리케이션을 시작합니다...${NC}"
        sleep 1
        ./run_app.sh
    else
        echo -e "${YELLOW}나중에 ./run_app.sh 명령으로 실행하세요!${NC}"
    fi
}

# 메인 실행 함수
main() {
    # 헤더 출력
    print_header
    
    # 현재 디렉토리 확인
    if [ ! -f "app.py" ]; then
        print_error "app.py 파일을 찾을 수 없습니다."
        echo "이 스크립트를 프로젝트 폴더에서 실행해주세요."
        exit 1
    fi
    
    # 단계별 실행
    check_python
    check_pip
    create_venv
    activate_venv
    upgrade_pip
    install_packages
    check_app_files
    create_run_script
    create_desktop_shortcut
    
    # 완료 메시지
    print_completion
}

# 스크립트 시작
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi