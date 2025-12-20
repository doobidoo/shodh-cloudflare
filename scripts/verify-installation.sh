#!/bin/bash

# SHODH-Cloudflare Installation Verification Script
# This script checks if SHODH-Cloudflare is properly installed and configured

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Icons
CHECK="✅"
CROSS="❌"
WARN="⚠️"
INFO="ℹ️"

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Function to print colored output
print_status() {
    local status=$1
    local message=$2

    case $status in
        "pass")
            echo -e "${GREEN}${CHECK} PASS${NC}: $message"
            ((PASSED++))
            ;;
        "fail")
            echo -e "${RED}${CROSS} FAIL${NC}: $message"
            ((FAILED++))
            ;;
        "warn")
            echo -e "${YELLOW}${WARN} WARN${NC}: $message"
            ((WARNINGS++))
            ;;
        "info")
            echo -e "${BLUE}${INFO} INFO${NC}: $message"
            ;;
    esac
}

# Function to print section header
print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

# Get Claude Desktop config path based on OS
get_config_path() {
    local os=$(detect_os)

    case $os in
        "macos")
            echo "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
            ;;
        "linux")
            echo "$HOME/.config/Claude/claude_desktop_config.json"
            ;;
        "windows")
            echo "$APPDATA/Claude/claude_desktop_config.json"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Main verification script
main() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  SHODH-Cloudflare Installation Verification           ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Check 1: Node.js version
    print_header "1. Node.js Environment"

    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)

        if [ "$NODE_MAJOR" -ge 18 ]; then
            print_status "pass" "Node.js version: $NODE_VERSION (>= 18.0.0 required)"
        else
            print_status "fail" "Node.js version: $NODE_VERSION (>= 18.0.0 required)"
            echo "  → Fix: Install Node.js 18+ from https://nodejs.org"
        fi
    else
        print_status "fail" "Node.js is not installed"
        echo "  → Fix: Install Node.js 18+ from https://nodejs.org"
    fi

    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_status "pass" "npm version: $NPM_VERSION"
    else
        print_status "fail" "npm is not installed"
        echo "  → Fix: npm comes with Node.js - reinstall Node.js"
    fi

    # Check 2: MCP Bridge Dependencies
    print_header "2. MCP Bridge Dependencies"

    # Try to find the script's directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    MCP_BRIDGE_DIR="$PROJECT_ROOT/mcp-bridge"

    if [ -d "$MCP_BRIDGE_DIR" ]; then
        if [ -d "$MCP_BRIDGE_DIR/node_modules" ]; then
            if [ -d "$MCP_BRIDGE_DIR/node_modules/@modelcontextprotocol" ]; then
                print_status "pass" "MCP SDK installed in $MCP_BRIDGE_DIR"
            else
                print_status "fail" "@modelcontextprotocol/sdk not found"
                echo "  → Fix: cd $MCP_BRIDGE_DIR && npm install"
            fi
        else
            print_status "fail" "node_modules not found in $MCP_BRIDGE_DIR"
            echo "  → Fix: cd $MCP_BRIDGE_DIR && npm install"
        fi

        if [ -f "$MCP_BRIDGE_DIR/index.js" ]; then
            print_status "pass" "MCP bridge entry point exists"
        else
            print_status "fail" "index.js not found in $MCP_BRIDGE_DIR"
        fi
    else
        print_status "fail" "MCP bridge directory not found: $MCP_BRIDGE_DIR"
        echo "  → Are you running this script from the shodh-cloudflare directory?"
    fi

    # Check 3: Claude Desktop Configuration
    print_header "3. Claude Desktop Configuration"

    CONFIG_PATH=$(get_config_path)

    if [ -z "$CONFIG_PATH" ]; then
        print_status "fail" "Could not detect OS or config path"
        echo "  → Supported OS: macOS, Linux, Windows (WSL)"
    elif [ -f "$CONFIG_PATH" ]; then
        print_status "pass" "Config file exists: $CONFIG_PATH"

        # Check if config has shodh-cloudflare entry
        if command -v jq &> /dev/null; then
            if jq -e '.mcpServers."shodh-cloudflare"' "$CONFIG_PATH" &> /dev/null; then
                print_status "pass" "shodh-cloudflare entry found in config"

                # Check environment variables
                URL=$(jq -r '.mcpServers."shodh-cloudflare".env.SHODH_CLOUDFLARE_URL' "$CONFIG_PATH")
                API_KEY=$(jq -r '.mcpServers."shodh-cloudflare".env.SHODH_CLOUDFLARE_API_KEY' "$CONFIG_PATH")

                if [ "$URL" != "null" ] && [ -n "$URL" ]; then
                    print_status "pass" "SHODH_CLOUDFLARE_URL is set"
                    WORKER_URL="$URL"
                else
                    print_status "fail" "SHODH_CLOUDFLARE_URL not set in config"
                    echo "  → Fix: Add env.SHODH_CLOUDFLARE_URL to config"
                fi

                if [ "$API_KEY" != "null" ] && [ -n "$API_KEY" ]; then
                    print_status "pass" "SHODH_CLOUDFLARE_API_KEY is set"
                    WORKER_API_KEY="$API_KEY"
                else
                    print_status "fail" "SHODH_CLOUDFLARE_API_KEY not set in config"
                    echo "  → Fix: Add env.SHODH_CLOUDFLARE_API_KEY to config"
                fi

                # Check command and args
                COMMAND=$(jq -r '.mcpServers."shodh-cloudflare".command' "$CONFIG_PATH")
                if [ "$COMMAND" = "node" ]; then
                    print_status "pass" "Command is 'node'"
                else
                    print_status "warn" "Command is '$COMMAND' (expected 'node')"
                fi

                ARGS=$(jq -r '.mcpServers."shodh-cloudflare".args[0]' "$CONFIG_PATH")
                if [ -f "$ARGS" ]; then
                    print_status "pass" "MCP bridge path exists: $ARGS"
                else
                    print_status "fail" "MCP bridge path not found: $ARGS"
                    echo "  → Fix: Update args[0] with correct absolute path"
                fi

            else
                print_status "fail" "shodh-cloudflare entry not found in config"
                echo "  → Fix: Run ./scripts/setup-client.sh to configure"
            fi
        else
            print_status "warn" "jq not installed - cannot validate config structure"
            echo "  → Install jq to enable config validation"
            echo "  → Manually check config has mcpServers.shodh-cloudflare entry"
        fi
    else
        print_status "fail" "Config file not found: $CONFIG_PATH"
        echo "  → Fix: Create config file or run Claude Desktop once"
        echo "  → Then run: ./scripts/setup-client.sh"
    fi

    # Check 4: Worker Connectivity
    print_header "4. Worker Connectivity"

    if [ -n "$WORKER_URL" ]; then
        # Test health endpoint
        if command -v curl &> /dev/null; then
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL/" --max-time 10)

            if [ "$HTTP_CODE" = "200" ]; then
                print_status "pass" "Worker is reachable (HTTP $HTTP_CODE)"

                # Test API authentication
                if [ -n "$WORKER_API_KEY" ]; then
                    AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
                                     -H "Authorization: Bearer $WORKER_API_KEY" \
                                     "$WORKER_URL/api/stats" --max-time 10)

                    if [ "$AUTH_CODE" = "200" ]; then
                        print_status "pass" "API authentication successful (HTTP $AUTH_CODE)"
                    elif [ "$AUTH_CODE" = "401" ]; then
                        print_status "fail" "API authentication failed (HTTP 401)"
                        echo "  → Fix: API key mismatch - check Worker secret and config"
                    elif [ "$AUTH_CODE" = "000" ]; then
                        print_status "fail" "Cannot connect to API endpoint (timeout or network error)"
                        echo "  → Fix: Check firewall, network, or Worker deployment"
                    else
                        print_status "fail" "API returned HTTP $AUTH_CODE"
                        echo "  → Fix: Check Worker logs with: cd worker && npm run tail"
                    fi
                else
                    print_status "warn" "Cannot test API auth - API key not found in config"
                fi

            elif [ "$HTTP_CODE" = "000" ]; then
                print_status "fail" "Cannot connect to Worker (timeout or network error)"
                echo "  → Fix: Check URL, firewall, or deploy Worker"
                echo "  → URL: $WORKER_URL"
            else
                print_status "fail" "Worker returned HTTP $HTTP_CODE"
                echo "  → Fix: Check Worker deployment status"
            fi
        else
            print_status "warn" "curl not installed - cannot test connectivity"
            echo "  → Install curl to enable connectivity tests"
        fi
    else
        print_status "warn" "Skipping connectivity test - Worker URL not configured"
    fi

    # Check 5: Functional Test (Optional - requires Claude not running)
    print_header "5. Functional Test"

    print_status "info" "Functional tests should be run in Claude Desktop"
    echo "  → Test in Claude: 'Show me my memory stats'"
    echo "  → Test in Claude: 'Remember this: Test memory'"
    echo "  → Test in Claude: 'Recall memories about test'"

    # Summary
    print_header "Summary"

    echo ""
    echo -e "Results:"
    echo -e "  ${GREEN}${CHECK} Passed: $PASSED${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "  ${YELLOW}${WARN} Warnings: $WARNINGS${NC}"
    fi
    if [ $FAILED -gt 0 ]; then
        echo -e "  ${RED}${CROSS} Failed: $FAILED${NC}"
    fi
    echo ""

    if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}  All checks passed! SHODH-Cloudflare is ready to use.${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Restart Claude Desktop if not already done"
        echo "  2. Test memory operations in Claude Desktop"
        echo "  3. See docs/INSTALLATION.md for usage examples"
        exit 0
    elif [ $FAILED -eq 0 ]; then
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}  Installation complete with $WARNINGS warning(s).${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "Review warnings above and fix if needed."
        echo "Most warnings are optional but recommended."
        exit 2
    else
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}  Installation verification failed with $FAILED error(s).${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "Please fix the failed checks above."
        echo "See docs/TROUBLESHOOTING.md for help."
        exit 1
    fi
}

# Run main function
main
