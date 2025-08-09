#!/bin/bash

# Korean Interior Estimate Web Application Installer
# 한국 인테리어 견적서 웹 애플리케이션 설치 스크립트

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="estimate-webapp"
APP_DIR="/opt/$APP_NAME"
SERVICE_NAME="$APP_NAME.service"
APP_USER="www-data"
APP_PORT="5002"

echo -e "${GREEN}=== Korean Interior Estimate Web Application Installer ===${NC}"
echo

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root${NC}"
   echo "Please run: sudo ./install.sh"
   exit 1
fi

# Install system dependencies
echo -e "${YELLOW}Installing system dependencies...${NC}"
apt-get update
apt-get install -y python3 python3-pip python3-venv systemd

# Create www-data user if it doesn't exist
if ! id "$APP_USER" &>/dev/null; then
    echo -e "${YELLOW}Creating $APP_USER user...${NC}"
    useradd --system --home /var/www --shell /bin/false $APP_USER
fi

# Create application directory
echo -e "${YELLOW}Creating application directory...${NC}"
mkdir -p $APP_DIR
cp -r . $APP_DIR/
cd $APP_DIR

# Create virtual environment
echo -e "${YELLOW}Setting up Python virtual environment...${NC}"
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo -e "${YELLOW}Installing Python dependencies...${NC}"
pip install --upgrade pip
pip install -r requirements.txt

# Set permissions
echo -e "${YELLOW}Setting up permissions...${NC}"
chown -R $APP_USER:$APP_USER $APP_DIR
chmod +x $APP_DIR/app.py

# Install systemd service
echo -e "${YELLOW}Installing systemd service...${NC}"
cp $APP_DIR/$SERVICE_NAME /etc/systemd/system/
systemctl daemon-reload
systemctl enable $SERVICE_NAME

# Flask app will run directly on port 5002
echo -e "${GREEN}Flask application will run directly on port $APP_PORT${NC}"

# Start the service
echo -e "${YELLOW}Starting the application service...${NC}"
systemctl start $SERVICE_NAME

# Check service status
sleep 3
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}✓ Service started successfully!${NC}"
else
    echo -e "${RED}✗ Service failed to start. Check logs with: journalctl -u $SERVICE_NAME${NC}"
    exit 1
fi

echo
echo
echo -e "${GREEN}=== Installation Complete ===${NC}"
echo -e "${GREEN}Service Status:${NC} $(systemctl is-active $SERVICE_NAME)"
echo
echo -e "${GREEN}Access the application at: http://your-server-ip:$APP_PORT${NC}"
echo
echo -e "${GREEN}Service Management Commands:${NC}"
echo "  Start:   systemctl start $SERVICE_NAME"
echo "  Stop:    systemctl stop $SERVICE_NAME"
echo "  Restart: systemctl restart $SERVICE_NAME"
echo "  Status:  systemctl status $SERVICE_NAME"
echo "  Logs:    journalctl -u $SERVICE_NAME -f"
echo
echo -e "${GREEN}Application installed and running as a systemd service!${NC}"
echo -e "${YELLOW}Note: Make sure to open port $APP_PORT in your firewall if needed.${NC}"

# Show final status
echo -e "${YELLOW}Final Status Check:${NC}"
systemctl status $SERVICE_NAME --no-pager -l