#!/bin/bash

# Korean Interior Estimate Web Application Test Script
# 한국 인테리어 견적서 웹 애플리케이션 테스트 스크립트

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

APP_NAME="estimate-webapp"
SERVICE_NAME="$APP_NAME.service"
APP_PORT="5002"

echo -e "${GREEN}=== Korean Interior Estimate Web Application Test ===${NC}"
echo

# Test service status
echo -e "${YELLOW}Testing service status...${NC}"
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}✓ Service is running${NC}"
else
    echo -e "${RED}✗ Service is not running${NC}"
    echo "Try: sudo systemctl start $SERVICE_NAME"
    exit 1
fi

# Test port accessibility
echo -e "${YELLOW}Testing port accessibility...${NC}"
if netstat -tlnp | grep -q ":$APP_PORT "; then
    echo -e "${GREEN}✓ Port $APP_PORT is listening${NC}"
else
    echo -e "${RED}✗ Port $APP_PORT is not listening${NC}"
    exit 1
fi

# Test HTTP response
echo -e "${YELLOW}Testing HTTP response...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$APP_PORT | grep -q "200"; then
    echo -e "${GREEN}✓ HTTP response is OK (200)${NC}"
else
    echo -e "${RED}✗ HTTP response failed${NC}"
    echo "Check logs: sudo journalctl -u $SERVICE_NAME -n 20"
    exit 1
fi

# Test database file
echo -e "${YELLOW}Testing database file...${NC}"
if [ -f "/opt/estimate-webapp/estimate.db" ]; then
    echo -e "${GREEN}✓ Database file exists${NC}"
else
    echo -e "${YELLOW}⚠ Database file not found (will be created on first use)${NC}"
fi

echo
echo -e "${GREEN}=== All Tests Passed! ===${NC}"
echo -e "${GREEN}Access the application at: http://your-server-ip:$APP_PORT${NC}"
echo
echo -e "${YELLOW}Service Information:${NC}"
systemctl status $SERVICE_NAME --no-pager -l