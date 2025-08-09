@echo off
chcp 65001 > nul
title 견적서 생성기

echo ================================================
echo 📊 인테리어 견적서 ^& 영수증 기록 생성기
echo ================================================
echo.

REM Python 버전 확인
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Python이 설치되어 있지 않습니다.
    echo 📥 https://python.org 에서 Python을 다운로드하여 설치해주세요.
    echo.
    pause
    exit /b 1
)

echo ✅ Python이 감지되었습니다.
echo 🚀 견적서 생성기를 시작합니다...
echo.

python app.py

echo.
echo 👋 프로그램이 종료되었습니다.
pause