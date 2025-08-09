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
