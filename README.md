# PolyBot — Automated Polymarket Trading Bot

A 24/7 autonomous trading bot for Polymarket BTC directional markets with a real-time web dashboard.

```
┌─────────────────────────────────────────────┐
│  POLYBOT  RUNNING  Balance: $450.00         │
├────────────────┬────────────────────────────┤
│ BTC 5-MIN      │ STRATEGIES                 │
│  ⏱  02:14     │  ▶ BTC 5min Momentum       │
│  Δ +$245.30   │  ▶ BTC 15min Reversal      │
│  UP:  0.612   │                            │
│  DOWN: 0.388  │ OPEN POSITIONS             │
├────────────────┤  1 position, +$0.42 unrlzd│
│ BTC 15-MIN     ├────────────────────────────┤
│  ⏱  08:45     │ TRADE HISTORY              │
│  Δ -$80.10    │  24 trades · 62% win rate  │
└────────────────┴────────────────────────────┘
```

## Features

- **Zero-latency BTC price feed** via Binance WebSocket (`@trade` stream)
- **Real-time Polymarket orderbooks** via CLOB WebSocket
- **Multi-strategy engine** with configurable entry/exit conditions
- **Automatic TP/SL management** — price or percentage based
- **Dry-run mode** — test strategies without placing real orders
- **Bloomberg-terminal dashboard** with live sparklines and condition previews
- **SQLite persistence** — survives restarts, full trade history
- **Auto-reconnect** — exponential backoff on all WebSocket connections
- **systemd service** — production-ready deployment

---

## Quick Start (VPS Setup)

### 1. Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install build tools (needed for better-sqlite3)
sudo apt install -y build-essential python3 git sqlite3

# Verify
node --version   # v20.x.x
npm --version    # 10.x.x
```

### 2. Create dedicated user

```bash
sudo useradd -r -s /bin/bash -m -d /opt/polybot polybot
sudo mkdir -p /opt/polybot/{data,logs}
```

### 3. Clone and set up

```bash
# As your regular user
cd ~
git clone <your-repo-url> polybot
cd polybot

# Install dependencies and build
make install
make build
```

### 4. Configure environment

```bash
cp .env.example .env
nano .env
```

Required settings:
```env
POLYMARKET_PRIVATE_KEY=0x_your_private_key_here
POLYMARKET_ADDRESS=0x_your_wallet_address_here
API_KEY=your_secure_random_key_here
PORT=3001
LOG_LEVEL=info
```

> **Security**: Never commit `.env` to version control. The private key signs orders on Polygon mainnet.

### 5. Deploy

```bash
make deploy
```

This copies built files to `/opt/polybot/`, installs the systemd service, and creates `/opt/polybot/.env` if it doesn't exist.

### 6. Configure the service environment

```bash
sudo nano /opt/polybot/.env
# Fill in your credentials
```

### 7. Start the bot

```bash
sudo systemctl start polybot
sudo systemctl enable polybot   # auto-start on reboot
make logs                        # watch live logs
```

### 8. Open the dashboard

```
http://YOUR_VPS_IP:3001?apiKey=YOUR_API_KEY
```

---

## Dashboard Walkthrough

### Market Panel (left 40%)

Each card shows one timeframe (5-min or 15-min):

- **Countdown timer** — time remaining in current candle, updates every 100ms
- **Progress bar** — visual percent of candle elapsed
- **BTC Delta** — `current_price − candle_open_price` in USD, green/red
- **UP / DOWN share prices** — live mid-prices with sparklines (last 60 ticks)
- **Bid/Ask spread** — best bid and ask for each outcome token
- **Last update** — milliseconds since last WebSocket tick

### Strategy Panel (right 60%)

Each row shows one strategy with:
- **Toggle switch** — enable/disable without deleting
- **READY badge** — all entry conditions currently satisfied
- **Condition preview** (expandable) — green ✓ / red ✗ for each condition
- **Today's stats** — trade count and P&L

Click **+ NEW** to open the strategy drawer.

### Strategy Drawer

Full form with all parameters:
- **Entry conditions** — time window, BTC delta range, share price range
- **Position sizing** — USDC per bet, limit vs market orders
- **Exit conditions** — take profit and stop loss (absolute price or % from entry)
- **Safety limits** — daily loss limit, cooldown after loss, max concurrent positions

### Positions Table

Live open positions with unrealized P&L. Click ✕ to close manually at market price.

### Analytics

- **Equity curve** — cumulative P&L over time
- **Win rate by strategy** — bar chart
- **P&L by hour** — identify best trading hours

---

## Strategy Configuration

Example strategy JSON:

```json
{
  "name": "BTC 5min Breakout",
  "enabled": true,
  "market": "BTC_5MIN",
  "side": "AUTO",
  "entry": {
    "timeAfterCandleOpenMinSec": "00:30",
    "timeAfterCandleOpenMaxSec": "03:00",
    "btcDeltaMinUsd": 100,
    "btcDeltaMaxUsd": 800,
    "btcDeltaFilterEnabled": true,
    "sharePriceMin": 0.45,
    "sharePriceMax": 0.65,
    "sharePriceFilterEnabled": true
  },
  "betAmountUsdc": 10,
  "useLimitOrder": false,
  "maxRoundsPerCandle": 1,
  "takeProfit": { "enabled": true, "mode": "ABSOLUTE_PRICE", "value": 0.72 },
  "stopLoss":   { "enabled": true, "mode": "ABSOLUTE_PRICE", "value": 0.30 },
  "maxConcurrentPositions": 1,
  "cooldownAfterLossSec": 0,
  "dailyLossLimitUsdc": 50
}
```

### Side: AUTO vs fixed

- `"AUTO"` — buys UP when BTC delta is positive, DOWN when negative
- `"UP"` / `"DOWN"` — always trades the specified direction regardless of price movement

### Exit modes

- `ABSOLUTE_PRICE` — TP at 0.72 means sell when share price reaches $0.72
- `PCT_FROM_ENTRY` — TP at 40 means sell when share price is +40% above entry

---

## Candle Timing

```
BTC_5MIN  opens at: 00:00, 00:05, 00:10, ... (minute % 5 == 0, UTC)
BTC_15MIN opens at: 00:00, 00:15, 00:30, 00:45 (minute % 15 == 0, UTC)

candle_open_price = first trade price at or after open timestamp
btc_delta_usd     = current_price − candle_open_price  (signed $)
```

---

## Dry-Run Mode

Leave `POLYMARKET_PRIVATE_KEY` unset or set to `mock` to run without placing real orders. The bot:

- Evaluates all strategies normally
- Simulates instant fills at current prices
- Records simulated trades in the database
- Shows `DRY-RUN` badge in the dashboard

Use this to backtest your strategy parameters before going live.

---

## Operations

### Common commands

```bash
make start          # Start the service
make stop           # Stop the service
make restart        # Restart (after config changes)
make logs           # Tail live logs
make logs-all       # Show last 200 lines
make status         # systemd status
make update         # git pull + rebuild + restart
make db-shell       # Open SQLite REPL
make db-backup      # Backup database
make clean          # Remove build artifacts
```

### Firewall (UFW)

```bash
# Only allow dashboard from your IP
sudo ufw allow from YOUR_IP to any port 3001

# Or allow from anywhere (less secure — use API_KEY!)
sudo ufw allow 3001/tcp
```

### Nginx reverse proxy (optional, for HTTPS)

```nginx
server {
    listen 443 ssl;
    server_name polybot.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/polybot.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/polybot.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Architecture

```
polybot/
├── backend/
│   ├── src/
│   │   ├── server.ts              # HTTP server, WS server, startup
│   │   └── modules/
│   │       ├── btc-feed.ts        # Binance @trade WebSocket
│   │       ├── candle-engine.ts   # 5min/15min candle state machine
│   │       ├── polymarket-feed.ts # CLOB orderbook WebSocket
│   │       ├── market-discovery.ts# REST API market discovery
│   │       ├── strategy-engine.ts # Entry/exit evaluation loop
│   │       ├── order-executor.ts  # EIP-712 order signing + REST
│   │       ├── database.ts        # SQLite schema + queries
│   │       └── logger.ts          # Winston logger
│   └── dist/                      # Compiled output
├── dashboard/
│   └── src/
│       ├── App.tsx
│       ├── hooks/
│       │   ├── useWebSocket.ts    # WS client with auto-reconnect
│       │   └── useMarketData.ts   # State manager for all WS messages
│       └── components/
│           ├── Header.tsx         # Status bar
│           ├── MarketCard.tsx     # BTC candle + share price display
│           ├── StrategyList.tsx   # Strategy rows with condition preview
│           ├── StrategyDrawer.tsx # Strategy create/edit form
│           ├── PositionsTable.tsx # Open positions
│           ├── TradeHistory.tsx   # Paginated trade log
│           └── Charts.tsx         # Equity curve, win rate, hourly P&L
├── data/
│   └── polybot.db                 # SQLite database (auto-created)
├── .env.example
├── Makefile
├── polybot.service
└── README.md
```

### Data flow

```
Binance WS ──trade tick──► CandleEngine ──candle update──► StrategyEngine
                                                                   │
Polymarket WS ──orderbook──► PolymarketFeed ──mid price──►────────┘
                                                                   │
                                                          Evaluate conditions
                                                                   │
                                                         ┌─────────▼─────────┐
                                                         │  Entry conditions  │
                                                         │  met? → place order│
                                                         │  TP/SL hit? → exit │
                                                         └─────────┬──────────┘
                                                                   │
                                                            OrderExecutor
                                                         (EIP-712 sign + POST)
                                                                   │
                                                              SQLite DB
                                                                   │
                                                           WebSocket Server
                                                                   │
                                                          Dashboard (React)
```

---

## Security Notes

1. **Private key** — stored only in `.env`, never logged. The key signs Polygon transactions. Use a dedicated trading wallet, not your main wallet.
2. **API key** — required to connect to the dashboard WebSocket. Use a strong random string.
3. **Firewall** — restrict port 3001 to your IP unless using Nginx + HTTPS.
4. **Funds** — only deposit what you're willing to risk. Start with dry-run mode.
5. **Polymarket CLOB approval** — your wallet must approve the CLOB contract to spend USDC. Do this via the Polymarket UI before the bot can trade.

---

## Troubleshooting

### Bot doesn't find any markets
- Polymarket BTC 5-min and 15-min markets rotate frequently (new market each candle)
- The bot auto-discovers them every 5 minutes
- Check logs: `make logs` and look for "Discovering Polymarket BTC markets"
- If no markets are found, the bot runs in mock mode and won't place orders

### Orders fail with authentication error
- Ensure `POLYMARKET_PRIVATE_KEY` and `POLYMARKET_ADDRESS` match
- Ensure your wallet has approved the CLOB contract for USDC spending
- Check that you have USDC balance on Polygon mainnet

### Dashboard shows "DISCONNECTED"
- Verify the backend is running: `make status`
- Check that port 3001 is open in the firewall
- Verify the API key in the URL matches `API_KEY` in `.env`

### High memory usage
- Normal RSS is <150MB
- If higher, check for WebSocket reconnect loops in logs
- Restart with `make restart`

---

## License

MIT — Use at your own risk. This bot trades real money on prediction markets. Past strategy performance does not guarantee future results.
