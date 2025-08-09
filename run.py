#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
인테리어 견적서 & 영수증 기록 생성기 실행 스크립트
"""

import subprocess
import sys
import os

def install_requirements():
    """필요한 패키지 설치"""
    print("필요한 Python 패키지를 설치합니다...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ 패키지 설치 완료")
        return True
    except subprocess.CalledProcessError:
        print("❌ 패키지 설치 실패")
        return False

def main():
    print("=" * 50)
    print("🏠 인테리어 견적서 & 영수증 기록 생성기")
    print("=" * 50)
    
    # 현재 디렉토리 확인
    if not os.path.exists("app.py"):
        print("❌ app.py 파일을 찾을 수 없습니다.")
        print("   이 스크립트를 프로젝트 폴더에서 실행해주세요.")
        return
    
    # requirements.txt 확인 및 패키지 설치
    if os.path.exists("requirements.txt"):
        if not install_requirements():
            print("패키지 설치에 실패했습니다. 수동으로 설치해주세요:")
            print("pip install Flask pandas==2.0.3 openpyxl numpy==1.24.4")
            return
    
    # Flask 앱 실행
    print("\n🚀 웹 서버를 시작합니다...")
    print("📝 웹 브라우저에서 http://127.0.0.1:5002 으로 접속하세요")
    print("⛔ 종료하려면 Ctrl+C를 누르세요")
    print("-" * 50)
    
    try:
        from app import app, init_db
        init_db()  # 데이터베이스 초기화
        app.run(debug=True, host='127.0.0.1', port=5002)
    except ImportError as e:
        print(f"❌ 모듈 import 오류: {e}")
        print("필요한 패키지가 설치되지 않았을 수 있습니다.")
        print("다음 명령으로 패키지를 설치해주세요:")
        print("pip install Flask pandas==2.0.3 openpyxl numpy==1.24.4")
    except KeyboardInterrupt:
        print("\n\n👋 서버를 종료합니다.")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    main()