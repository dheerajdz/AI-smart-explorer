# Smart AI Explorer

> The Blockchain You Can Text

AI-powered blockchain assistant for the XDC ecosystem. Query blockchain data using natural language via Telegram and WhatsApp.

## Tech Stack

- **Backend:** Node.js, TypeScript, Express.js, MongoDB Atlas, Redis, node-cron, Telegraf
- **Frontend:** Next.js, TypeScript, TailwindCSS
- **AI:** Kimi API
- **Blockchain:** Blockscout APIs, XDCScan APIs

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (optional, for local Redis & MongoDB)

### Backend

```bash
cd backend
cp .env.example .env
# Fill in your environment variables
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker Services

```bash
docker-compose up -d
```

## Project Structure

```
AI-smart-explorer/
├── frontend/          # Next.js app
├── backend/           # Express + bot engines
│   ├── src/
│   │   ├── bots/
│   │   │   ├── telegram/      # Telegram bot (Telegraf)
│   │   │   └── whatsapp/      # WhatsApp bot (placeholder)
│   │   ├── controllers/
│   │   ├── cron/
│   │   ├── database/          # MongoDB & Redis connections
│   │   ├── middleware/
│   │   ├── models/            # Mongoose schemas
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── ai/            # Kimi AI service
│   │   │   ├── blockchain/    # Blockscout & XDCScan
│   │   │   └── notification/  # Telegram & WhatsApp notifications
│   │   ├── types/
│   │   ├── utils/
│   │   └── index.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── docs/
├── README.md
└── docker-compose.yml
```

## Bot Commands

### Telegram

| Command     | Description          |
|-------------|----------------------|
| `/start`    | Welcome message      |
| `/track`    | Track a wallet       |
| `/untrack`  | Untrack a wallet     |
| `/list`     | List tracked wallets |
| `/balance`  | Get wallet balance   |
| `/price`    | Get XDC price        |
| `/status`   | Get network status   |

### WhatsApp (planned)

Same commands without the `/` prefix.

## License

MIT
