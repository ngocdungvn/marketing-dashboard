#!/bin/bash
# ============================================
# Cloudflare Tunnel Setup for DigiDash
# Run inside the LXC container after setup-lxc.sh
# ============================================

set -e

echo "=== Cloudflare Tunnel Setup ==="

# 1. Install cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo "Installing cloudflared..."
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    dpkg -i cloudflared.deb
    rm cloudflared.deb
fi

echo ""
echo "=== Cloudflare Tunnel Configuration ==="
echo ""
echo "Step 1: Login to Cloudflare"
echo "  cloudflared tunnel login"
echo ""
echo "Step 2: Create tunnel"
echo "  cloudflared tunnel create digidash"
echo ""
echo "Step 3: Configure DNS (replace YOUR_DOMAIN)"
echo "  cloudflared tunnel route dns digidash dashboard.YOUR_DOMAIN.com"
echo ""
echo "Step 4: Create config file"
echo "  cat > /etc/cloudflared/config.yml << EOF"
echo "  tunnel: digidash"
echo "  credentials-file: /root/.cloudflared/<TUNNEL_ID>.json"
echo ""
echo "  ingress:"
echo "    - hostname: dashboard.YOUR_DOMAIN.com"
echo "      service: http://localhost:8081"
echo "    - service: http_status:404"
echo "  EOF"
echo ""
echo "Step 5: Install as service & start"
echo "  cloudflared service install"
echo "  systemctl start cloudflared"
echo ""
echo "Done! Your dashboard will be at https://dashboard.YOUR_DOMAIN.com"
