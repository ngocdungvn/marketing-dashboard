#!/bin/bash
# ============================================
# DigiDash - LXC Setup Script
# Run inside the Proxmox LXC container
# ============================================

set -e

echo "=== DigiDash LXC Setup ==="

# 1. Update system
apt update && apt upgrade -y

# 2. Install Python 3 + Git
apt install -y python3 python3-pip git curl

# 3. Clone the project
cd /opt
if [ -d "digidash" ]; then
    echo "Updating existing installation..."
    cd digidash && git pull
else
    git clone https://github.com/ngocdungvn/marketing-dashboard.git digidash
    cd digidash
fi

# 4. Create email config if not exists
if [ ! -f "email_config.json" ] || [ ! -s "email_config.json" ] || grep -q '"smtp_user": ""' email_config.json 2>/dev/null; then
    echo "⚠️  Please edit /opt/digidash/email_config.json with your SMTP credentials"
fi

# 5. Install systemd service
cp deploy/digidash.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable digidash
systemctl start digidash

echo ""
echo "=== Setup Complete ==="
echo "Dashboard: http://$(hostname -I | awk '{print $1}'):8081"
echo "Service:   systemctl status digidash"
echo ""
echo "Next steps:"
echo "  1. Edit /opt/digidash/email_config.json with SMTP credentials"
echo "  2. Edit /opt/digidash/sheets_config.json with Google Sheet URLs"
echo "  3. Install Cloudflare Tunnel (run deploy/setup-tunnel.sh)"
