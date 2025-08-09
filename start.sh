#!/bin/bash

echo "================================================"
echo "📊 인테리어 견적서 & 영수증 기록 생성기"
echo "================================================"
echo

# Python 버전 확인
if ! command -v python3 &> /dev/null; then
    if ! command -v python &> /dev/null; then
        echo "❌ Python이 설치되어 있지 않습니다."
        echo "📥 https://python.org 에서 Python을 다운로드하여 설치해주세요."
        echo
        read -p "⏎ 엔터를 눌러 종료하세요..."
        exit 1
    else
        PYTHON_CMD="python"
    fi
else
    PYTHON_CMD="python3"
fi

echo "✅ Python이 감지되었습니다."
echo "🚀 견적서 생성기를 시작합니다..."
echo

$PYTHON_CMD app.py

echo
echo "👋 프로그램이 종료되었습니다."
read -p "⏎ 엔터를 눌러 종료하세요..."