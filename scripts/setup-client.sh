#!/bin/bash
#
# SHODH Cloudflare MCP Bridge Setup Script
# 
# Usage: 
#   curl -fsSL https://raw.githubusercontent.com/YOUR_USER/shodh-cloudflare/main/scripts/setup-client.sh | bash
#   
# Or run locally:
#   ./scripts/setup-client.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   SHODH Cloudflare MCP Bridge Setup        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Detect OS
OS="unknown"
CONFIG_PATH=""
case "$(uname -s)" in
    Darwin*)
        OS="macOS"
        CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
        ;;
    Linux*)
        OS="Linux"
        CONFIG_PATH="$HOME/.config/Claude/claude_desktop_config.json"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        OS="Windows"
        CONFIG_PATH="$APPDATA/Claude/claude_desktop_config.json"
        ;;
esac

echo -e "${GREEN}Detected OS:${NC} $OS"
echo -e "${GREEN}Config path:${NC} $CONFIG_PATH"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js 18+ required. You have $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}Node.js:${NC} $(node -v) ✓"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}npm:${NC} $(npm -v) ✓"
echo ""

# Set install directory
INSTALL_DIR="$HOME/mcp-servers/shodh-cloudflare"

echo -e "${YELLOW}Installing to:${NC} $INSTALL_DIR"
echo ""

# Create directory
mkdir -p "$INSTALL_DIR/mcp-bridge"
cd "$INSTALL_DIR"

# Download or clone
if command -v git &> /dev/null; then
    echo -e "${BLUE}Cloning repository...${NC}"
    if [ -d ".git" ]; then
        git pull
    else
        git clone https://github.com/YOUR_USER/shodh-cloudflare.git temp_clone
        mv temp_clone/* .
        mv temp_clone/.* . 2>/dev/null || true
        rm -rf temp_clone
    fi
else
    echo -e "${BLUE}Downloading files...${NC}"
    # Download essential files directly
    curl -fsSL -o mcp-bridge/index.js https://raw.githubusercontent.com/YOUR_USER/shodh-cloudflare/main/mcp-bridge/index.js
    curl -fsSL -o mcp-bridge/package.json https://raw.githubusercontent.com/YOUR_USER/shodh-cloudflare/main/mcp-bridge/package.json
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
cd mcp-bridge
npm install
echo ""

# Get API key from user
echo -e "${YELLOW}╔════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   API Key Required                         ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════╝${NC}"
echo ""
echo "Enter your SHODH Cloudflare API key"
echo "(Get this from whoever deployed the Cloudflare Worker)"
echo ""
read -sp "API Key: " API_KEY
echo ""
echo ""

if [ -z "$API_KEY" ]; then
    echo -e "${RED}Error: API key cannot be empty${NC}"
    exit 1
fi

# Generate config snippet
CONFIG_SNIPPET=$(cat <<EOF
{
  "shodh-cloudflare": {
    "command": "node",
    "args": ["$INSTALL_DIR/mcp-bridge/index.js"],
    "env": {
      "SHODH_CLOUDFLARE_URL": "https://your-worker-name.your-subdomain.workers.dev",
      "SHODH_CLOUDFLARE_API_KEY": "$API_KEY"
    }
  }
}
EOF
)

echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Setup Complete!                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Add the following to your Claude Desktop config:${NC}"
echo -e "${BLUE}$CONFIG_PATH${NC}"
echo ""
echo "Add this to the \"mcpServers\" section:"
echo ""
echo -e "${GREEN}$CONFIG_SNIPPET${NC}"
echo ""
echo -e "${YELLOW}Then restart Claude Desktop.${NC}"
echo ""

# Try to open config file
if [ "$OS" = "macOS" ]; then
    echo "Would you like to open the config file now? (y/n)"
    read -r OPEN_CONFIG
    if [ "$OPEN_CONFIG" = "y" ] || [ "$OPEN_CONFIG" = "Y" ]; then
        open -e "$CONFIG_PATH" 2>/dev/null || echo "Could not open config file automatically."
    fi
fi

echo ""
echo -e "${GREEN}Verify installation by asking Claude to run:${NC}"
echo "  shodh-cloudflare:memory_stats"
echo ""
