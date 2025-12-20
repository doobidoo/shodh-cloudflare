# Prerequisites & Requirements

Before you begin installing SHODH-Cloudflare, make sure you have everything you need. This guide will help you understand the requirements and prepare your environment.

## Table of Contents

- [Cloudflare Account Requirements](#cloudflare-account-requirements)
- [Development Environment](#development-environment)
- [Claude Desktop Requirements](#claude-desktop-requirements)
- [Network Requirements](#network-requirements)
- [Time & Cost Estimates](#time--cost-estimates)

---

## Cloudflare Account Requirements

### Do I need a Cloudflare account?

**Yes**, but the free tier is completely sufficient for most personal use cases!

### Free Tier Capabilities

SHODH-Cloudflare works perfectly on Cloudflare's free tier with the following limits:

#### D1 Database (SQLite)
- **Databases**: Up to 5 databases per account
- **Storage**: 500 MB per database
- **Reads**: 5 million rows read per day
- **Writes**: 100,000 rows written per day

For typical personal memory use, these limits are more than enough.

#### Vectorize (Vector Search)
- **Free tier available**: Yes
- **Dimensions**: 384 (using bge-small-en-v1.5 model)
- **Query limits**: Generous for personal use

#### Workers & Workers AI
- **Workers requests**: 100,000 requests/day (free tier)
- **CPU time**: 10ms per request (free tier)
- **Workers AI**: Free tier includes embeddings

### Creating a Cloudflare Account

If you don't have a Cloudflare account yet:

1. Go to [cloudflare.com](https://cloudflare.com)
2. Click "Sign Up" (top right)
3. Use your email and create a password
4. Verify your email address
5. No credit card required for free tier!

### Paid Plans (Optional)

You only need a paid plan if:
- You exceed free tier limits (unlikely for personal use)
- You need faster D1 query performance
- You require additional databases (>5)

**Cost estimate if you exceed free tier**: Typically $5-15/month for moderate usage

---

## Development Environment

### Node.js

**Required version**: 18.0.0 or higher

#### Why Node.js 18+?

SHODH-Cloudflare's MCP bridge uses:
- ES modules (`type: "module"`)
- Modern JavaScript features
- `@modelcontextprotocol/sdk` which requires Node 18+

#### Check your Node.js version

```bash
node --version
```

Expected output: `v18.x.x` or higher (e.g., `v20.10.0`)

#### Install or Update Node.js

**macOS (using Homebrew)**:
```bash
brew install node@20
```

**Linux (using nvm)**:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

**Windows**:
- Download from [nodejs.org](https://nodejs.org/)
- Install the LTS version (20.x or newer)

### npm

npm comes bundled with Node.js, but verify it's available:

```bash
npm --version
```

Expected output: `9.x.x` or higher

### Wrangler CLI (for Worker deployment)

**Only needed if you're deploying your own Worker** (not needed for client-only setup)

```bash
npm install -g wrangler
```

Verify installation:
```bash
wrangler --version
```

### Git (Optional but Recommended)

Used to clone the repository. You can also download as ZIP if preferred.

```bash
git --version
```

Install if needed:
- **macOS**: `brew install git`
- **Linux**: `sudo apt install git` or `sudo dnf install git`
- **Windows**: Download from [git-scm.com](https://git-scm.com/)

### Text Editor

You'll need a text editor to view/edit JSON config files:
- VS Code (recommended)
- Sublime Text
- Notepad++ (Windows)
- nano/vim (Linux/macOS)

---

## Claude Desktop Requirements

### Claude Desktop with MCP Support

SHODH-Cloudflare integrates with Claude Desktop via the Model Context Protocol (MCP).

#### Minimum Version

Claude Desktop must support MCP servers. This is available in:
- Claude Desktop version 0.5.0 or higher

#### Verify Claude Desktop

Open Claude Desktop and check:
1. Settings → Advanced → MCP Servers section exists
2. Or look for `claude_desktop_config.json` file

#### Config File Locations

The config file path varies by operating system:

**macOS**:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux**:
```
~/.config/Claude/claude_desktop_config.json
```

**Windows**:
```
%APPDATA%\Claude\claude_desktop_config.json
```

#### Permissions

Make sure you have:
- Read/write access to the config file
- Ability to restart Claude Desktop

---

## Network Requirements

### Internet Connectivity

SHODH-Cloudflare requires:
- **Outbound HTTPS** (port 443) to Cloudflare Workers
- **Stable connection** for API requests

### Firewall Considerations

If you're behind a corporate firewall:

**Whitelist these domains**:
- `*.workers.dev` (your Worker endpoint)
- `api.cloudflare.com` (if deploying/managing Worker)

### Proxy Support

If you're behind a proxy:
- Node.js respects `HTTP_PROXY` and `HTTPS_PROXY` environment variables
- Wrangler also respects these environment variables

Example:
```bash
export HTTPS_PROXY=http://proxy.company.com:8080
```

### SSL/TLS

- All communication uses HTTPS
- Requires valid SSL certificates (automatic with Cloudflare)
- No self-signed certificates

---

## Time & Cost Estimates

### Time to Complete Setup

#### First-Time Installation (Deploy Worker + Setup Client)

**Estimated time**: 30-45 minutes

Breakdown:
- Cloudflare account setup: 5 minutes (if new)
- Worker deployment: 15-20 minutes
- Client setup: 5-10 minutes
- Verification & testing: 5-10 minutes

If you're already familiar with Cloudflare: 20-30 minutes

#### Additional Devices (Client Setup Only)

**Estimated time**: 5-10 minutes per device

You only deploy the Worker once. Adding more devices just requires:
1. Clone repository
2. Run setup script
3. Restart Claude Desktop

### Cost Estimates

#### Free Tier (Most Users)

**Cost**: $0/month

Suitable for:
- Personal memory management
- Up to ~10,000 memories
- Daily Claude interactions
- Multiple devices

#### If You Exceed Free Tier

**Typical cost**: $5-15/month

Example usage that might exceed free tier:
- >100,000 memory operations/day
- >500 MB of memory data
- Enterprise/team usage

#### Cost Breakdown (Paid Tier)

- **D1**: ~$5/month (5M rows read + 1M rows written)
- **Workers**: ~$5/month (10M requests)
- **Workers AI**: Included or minimal cost for embeddings

**Total**: Most users will stay on free tier indefinitely.

---

## Pre-Installation Checklist

Before proceeding to installation, verify:

- [ ] **Cloudflare account** created (free tier OK)
- [ ] **Node.js 18+** installed (`node --version`)
- [ ] **npm** available (`npm --version`)
- [ ] **Claude Desktop** with MCP support installed
- [ ] **Config file location** identified for your OS
- [ ] **Internet connection** stable (HTTPS access to Cloudflare)
- [ ] **30-45 minutes** available for first-time setup
- [ ] **Text editor** ready for config file editing

Optional:
- [ ] **Git** installed (or prepared to download ZIP)
- [ ] **Wrangler** installed if deploying Worker yourself

---

## What's Next?

Once you've verified all prerequisites:

1. **First-time user deploying your own Worker?**
   → Continue to [Installation Guide](INSTALLATION.md) - Part 1: Worker Deployment

2. **Adding a new device to existing Worker?**
   → Skip to [Installation Guide](INSTALLATION.md) - Part 2: Client Setup

3. **Running into issues?**
   → Check [Troubleshooting Guide](TROUBLESHOOTING.md)

4. **Have questions?**
   → See [FAQ](FAQ.md)

---

## Common Questions

**Q: Can I use a paid Cloudflare plan?**
A: Yes! Paid plans offer higher limits and performance, but are not required.

**Q: Do I need a domain name?**
A: No! Workers get a free `*.workers.dev` subdomain automatically.

**Q: Can I run this locally without Cloudflare?**
A: Not as-is. SHODH-Cloudflare is designed specifically for Cloudflare's edge infrastructure. For local deployments, see the original [SHODH project](https://github.com/ericflo/SHODH).

**Q: How many devices can I connect?**
A: Unlimited! Each device runs the MCP bridge client connecting to your single Worker.

**Q: Is my data private?**
A: Yes. When you deploy your own Worker, all data stays in your Cloudflare account. No third parties have access.

---

## Need Help?

- **Installation issues**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **General questions**: See [FAQ.md](FAQ.md)
- **Multi-device setup**: See [MULTI_DEVICE.md](MULTI_DEVICE.md)
- **Report bugs**: [GitHub Issues](https://github.com/YOUR_USER/shodh-cloudflare/issues)
