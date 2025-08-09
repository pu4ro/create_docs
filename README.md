# 한국 인테리어 견적서 & 일일 사용 명세서 생성기

Flask 기반의 웹 애플리케이션으로 인테리어 견적서와 일일 영수증 기록을 관리할 수 있는 시스템입니다.

## 🚀 빠른 설치

### 자동 설치 (권장)
```bash
# 저장소 클론
git clone https://github.com/pu4ro/create_docs.git
cd create_docs

# 자동 설치 실행 (root 권한 필요)
sudo ./install.sh
```

### 접속 방법
- **URL**: `http://your-server-ip:5002`

## 📋 주요 기능

### 📋 인테리어 견적서 생성
- **자동 견적번호 생성**: YYMMDD-XXX 형식으로 자동 생성
- **회사/고객 정보 관리**: 드롭다운으로 저장된 정보 선택 및 재사용
- **사업자등록번호 자동 포맷팅**: 000-00-00000 형식으로 자동 변환
- **전화번호 자동 포맷팅**: 000-0000-0000 형식으로 자동 변환
- **견적 항목 관리**: 공종별 분류 및 필터링 기능
- **엑셀/PDF 내보내기**: 한글 지원 완벽 엑셀 및 PDF 파일 생성
- **견적서 미리보기**: 실제 출력 형태로 미리보기 가능

### 💰 일일 영수증 기록 관리
- **현장별 일일 사용 내역 기록**: 현장명과 날짜별 분류
- **카테고리별 분류**: 용역비, 기타 등으로 구분
- **자동 합계 계산**: 실시간 금액 합계 계산
- **엑셀 내보내기**: 일일 기록을 엑셀 파일로 내보내기

### 🗄️ 데이터베이스 관리
- **다중선택 일괄삭제**: 체크박스로 여러 항목 선택 후 일괄 삭제
- **전체선택/해제**: 한 번에 모든 항목 선택/해제
- **실시간 선택 개수 표시**: 현재 선택된 항목 수 표시
- **데이터 타입별 조회**: 견적서, 영수증 기록, 회사 정보, 고객 정보 분류 조회
- **저장된 데이터 불러오기**: 기존 데이터를 양식에 다시 로드

### 🏦 은행계좌 정보 관리
- **계좌 정보 저장**: 은행명, 계좌번호, 예금주 정보 관리
- **드롭다운 선택**: 저장된 계좌 정보 쉽게 선택

## 시스템 요구사항

- **운영체제**: Ubuntu 18.04+ / Debian 9+ / CentOS 7+ (systemd 지원)
- **Python**: 3.6 이상
- **메모리**: 최소 512MB RAM
- **저장공간**: 최소 100MB
- **네트워크**: 포트 5002 접근 가능

## 서비스 관리

### systemctl 명령어

```bash
# 서비스 시작
sudo systemctl start estimate-webapp

# 서비스 중지
sudo systemctl stop estimate-webapp

# 서비스 재시작
sudo systemctl restart estimate-webapp

# 서비스 상태 확인
sudo systemctl status estimate-webapp

# 부팅 시 자동 시작 활성화
sudo systemctl enable estimate-webapp

# 부팅 시 자동 시작 비활성화
sudo systemctl disable estimate-webapp

# 로그 확인
sudo journalctl -u estimate-webapp -f
```

## 파일 구조

```
/opt/estimate-webapp/
├── app.py                      # Flask 메인 애플리케이션
├── requirements.txt            # Python 패키지 의존성
├── estimate-webapp.service     # systemd 서비스 파일
├── templates/
│   └── index.html             # HTML 템플릿
├── static/
│   ├── style.css              # CSS 스타일시트
│   └── script.js              # JavaScript 파일
├── venv/                      # Python 가상환경
└── estimate.db               # SQLite 데이터베이스 (자동 생성)
```

## 보안 설정

- **사용자 격리**: www-data 사용자로 실행하여 시스템 보안 강화
- **디렉토리 권한**: 애플리케이션 디렉토리만 접근 가능
- **systemd 보안**: NoNewPrivileges, PrivateTmp, ProtectSystem 등 강화된 보안 설정
- **네트워크**: Flask 앱이 직접 포트 5002에서 실행 (nginx 불필요)
- **방화벽**: 필요시 포트 5002만 개방하여 최소한의 노출

## 백업 및 복구

### 데이터베이스 백업
```bash
sudo cp /opt/estimate-webapp/estimate.db /backup/estimate_$(date +%Y%m%d).db
```

### 전체 애플리케이션 백업
```bash
sudo tar -czf /backup/estimate-webapp_$(date +%Y%m%d).tar.gz -C /opt estimate-webapp
```

## 문제 해결

### 서비스가 시작되지 않는 경우
```bash
# 로그 확인
sudo journalctl -u estimate-webapp -n 50

# 파이썬 가상환경 확인
sudo -u www-data /opt/estimate-webapp/venv/bin/python --version

# 권한 확인
sudo ls -la /opt/estimate-webapp/
```

### 포트 충돌 해결
```bash
# 포트 5002 사용 확인
sudo netstat -tlnp | grep :5002

# app.py에서 포트 변경 후 서비스 재시작
sudo systemctl restart estimate-webapp
```

### 방화벽 설정 (필요시)
```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 5002

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=5002/tcp
sudo firewall-cmd --reload
```

## 업데이트

```bash
# 서비스 중지
sudo systemctl stop estimate-webapp

# 코드 업데이트
cd /opt/estimate-webapp
sudo git pull

# 의존성 업데이트
sudo -u www-data /opt/estimate-webapp/venv/bin/pip install -r requirements.txt

# 권한 재설정
sudo chown -R www-data:www-data /opt/estimate-webapp

# 서비스 재시작
sudo systemctl start estimate-webapp
```

## 개발자 정보

- **개발자**: pu4ro
- **이메일**: weondong94@gmail.com
- **저장소**: https://github.com/pu4ro/create_docs.git

## 라이선스

이 프로젝트는 개인 및 상업적 용도로 자유롭게 사용할 수 있습니다.

---

**🚀 설치 후 웹 브라우저에서 접속하여 한국어 인테리어 견적서를 쉽게 작성해보세요!**