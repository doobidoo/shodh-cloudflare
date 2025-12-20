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

# Icons
CHECK="✅"
CROSS="❌"
WARN="⚠️"

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

# Get Worker URL from user
echo -e "${YELLOW}╔════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   Worker Configuration                     ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════╝${NC}"
echo ""
echo "Enter your SHODH Cloudflare Worker URL"
echo "(Example: https://shodh-api.your-subdomain.workers.dev)"
echo ""
read -p "Worker URL: " WORKER_URL
echo ""

if [ -z "$WORKER_URL" ]; then
    echo -e "${RED}Error: Worker URL cannot be empty${NC}"
    exit 1
fi

# Validate Worker URL format
if [[ ! "$WORKER_URL" =~ ^https?:// ]]; then
    echo -e "${YELLOW}${WARN} Adding https:// prefix to URL${NC}"
    WORKER_URL="https://$WORKER_URL"
fi

# Remove trailing slash if present
WORKER_URL="${WORKER_URL%/}"

# Test Worker URL connectivity
echo -e "${BLUE}Testing Worker connectivity...${NC}"
if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL/" --max-time 10)
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}${CHECK} Worker is reachable (HTTP $HTTP_CODE)${NC}"
    elif [ "$HTTP_CODE" = "000" ]; then
        echo -e "${RED}${CROSS} Cannot connect to Worker (timeout or network error)${NC}"
        echo -e "${YELLOW}${WARN} Proceeding anyway - please verify URL is correct${NC}"
        echo ""
        read -p "Continue anyway? (y/n): " CONTINUE
        if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
            echo "Setup cancelled."
            exit 1
        fi
    else
        echo -e "${YELLOW}${WARN} Worker returned HTTP $HTTP_CODE (expected 200)${NC}"
        echo -e "${YELLOW}${WARN} Proceeding anyway - verify Worker is deployed correctly${NC}"
    fi
else
    echo -e "${YELLOW}${WARN} curl not installed - cannot test connectivity${NC}"
fi
echo ""

# Get API key from user
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

# Test API authentication
echo -e "${BLUE}Testing API authentication...${NC}"
if command -v curl &> /dev/null; then
    AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
                     -H "Authorization: Bearer $API_KEY" \
                     "$WORKER_URL/api/stats" --max-time 10)

    if [ "$AUTH_CODE" = "200" ]; then
        echo -e "${GREEN}${CHECK} API authentication successful (HTTP $AUTH_CODE)${NC}"
    elif [ "$AUTH_CODE" = "401" ]; then
        echo -e "${RED}${CROSS} API authentication failed (HTTP 401)${NC}"
        echo -e "${YELLOW}${WARN} The API key may be incorrect${NC}"
        echo ""
        read -p "Continue anyway? (y/n): " CONTINUE
        if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
            echo "Setup cancelled. Please verify your API key."
            exit 1
        fi
    elif [ "$AUTH_CODE" = "000" ]; then
        echo -e "${YELLOW}${WARN} Cannot test authentication (network error)${NC}"
    else
        echo -e "${YELLOW}${WARN} API returned HTTP $AUTH_CODE${NC}"
    fi
fi
echo ""

# Create config backup if file exists
if [ -f "$CONFIG_PATH" ]; then
    BACKUP_PATH="${CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${BLUE}Creating backup of config file...${NC}"
    cp "$CONFIG_PATH" "$BACKUP_PATH"
    echo -e "${GREEN}${CHECK} Backup created: $BACKUP_PATH${NC}"
    echo ""
fi

# Generate config snippet
CONFIG_SNIPPET=$(cat <<EOF
{
  "shodh-cloudflare": {
    "command": "node",
    "args": ["$INSTALL_DIR/mcp-bridge/index.js"],
    "env": {
      "SHODH_CLOUDFLARE_URL": "$WORKER_URL",
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
echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Next Steps${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
echo ""
echo "1. ${GREEN}Restart Claude Desktop${NC} (important!)"

# Detect if Claude is running
CLAUDE_RUNNING=false
if [ "$OS" = "macOS" ]; then
    if pgrep -x "Claude" > /dev/null; then
        CLAUDE_RUNNING=true
        echo "   ${YELLOW}${WARN} Claude Desktop is currently running${NC}"
        echo "   ${YELLOW}${WARN} Please quit and restart it${NC}"
    fi
elif [ "$OS" = "Linux" ]; then
    if pgrep -i "claude" > /dev/null; then
        CLAUDE_RUNNING=true
        echo "   ${YELLOW}${WARN} Claude Desktop is currently running${NC}"
        echo "   ${YELLOW}${WARN} Please quit and restart it${NC}"
    fi
fi

echo ""
echo "2. ${GREEN}Verify installation${NC}"
echo "   Run: ${BLUE}./scripts/verify-installation.sh${NC}"
echo ""
echo "3. ${GREEN}Test in Claude Desktop${NC}"
echo "   Ask Claude: 'Show me my memory stats'"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  Troubleshooting${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
echo "If you encounter issues:"
echo "  • See docs/TROUBLESHOOTING.md"
echo "  • Check logs in ~/Library/Logs/Claude/ (macOS)"
echo "  • Verify config at: $CONFIG_PATH"
echo ""

# Offer to run verification script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERIFY_SCRIPT="$SCRIPT_DIR/verify-installation.sh"

if [ -f "$VERIFY_SCRIPT" ]; then
    echo ""
    read -p "Would you like to run the verification script now? (y/n): " RUN_VERIFY
    if [ "$RUN_VERIFY" = "y" ] || [ "$RUN_VERIFY" = "Y" ]; then
        echo ""
        echo -e "${BLUE}Running verification...${NC}"
        echo ""
        bash "$VERIFY_SCRIPT"
    fi
fi

echo ""
