# Implementation Plan: Unified Multi-Channel Bot Architecture

## Branch
`feat/unified-bot-dispatcher`

Base: `feat/bot-erc8004` (latest)

---

## Goal
Extract all shared bot logic into a single dispatcher so Telegram, WhatsApp, Slack, and X are thin platform adapters. Future channels should require ~50 lines of adapter code.

---

## Phase 1: Foundation (No behavior change)

### 1.1 Create shared types
**File:** `src/bots/shared/types.ts`

```ts
export type Platform = 'telegram' | 'whatsapp' | 'slack' | 'x';

export interface BotContext {
  platform: Platform;
  userId: string;
  text: string;
}

export interface BotResponse {
  text: string;
  parseMode?: 'markdown' | 'html' | 'plain';
}
```

### 1.2 Create shared welcome service
**File:** `src/bots/shared/welcome.ts`

- Accept `(platform, userId)`
- Check `hasConnectedWallet(userId, platform)`
- Return `BotResponse`
- Reuse logic from current WhatsApp + Telegram welcome flows

### 1.3 Create shared command router
**File:** `src/bots/shared/commandRouter.ts`

Move all slash-command handling from:
- `src/bots/telegram/commands.ts` (partial)
- `src/bots/whatsapp/messageHandler.ts` (partial)
- `src/services/commandHandler.ts` (deprecated, merge in)

Commands to support:
- `/help`
- `/start`
- `/balance [address]`
- `/tx [address]`
- `/activity [address]`
- `/track [address]`
- `/untrack [address]`
- `/list`
- `/gas`
- `/block [number]`
- `/failed [address]`
- `/large [address]`
- `/price`
- `/status`
- `/disconnect`

Each command receives `(platform, userId, args)` and returns `BotResponse`.

### 1.4 Create shared keyword router
**File:** `src/bots/shared/keywordRouter.ts`

Move keyword handling from:
- `src/services/keywordRouter.ts`
- `src/bots/whatsapp/messageHandler.ts`
- `src/bots/telegram/commands.ts`

Keywords:
- `balance`, `how much`
- `transaction`, `history`, `tx history`
- `gas`, `fee`
- `block`
- `activity`, `stats`
- `failed`
- `large`, `whale`
- `price`, `cost`, `value`
- `status`, `network`
- `help`, `?`
- `track`, `monitor`, `watch`
- `untrack`, `stop monitoring`
- `list`, `tracked`, `my wallets`
- `connect wallet`, `add wallet`, `link wallet`
- `disconnect`, `remove wallet`, `logout wallet`
- greetings: `hi`, `hello`, `hey`, `start`

### 1.5 Create unified dispatcher
**File:** `src/bots/shared/dispatcher.ts`

```ts
export async function dispatch(
  platform: Platform,
  userId: string,
  text: string
): Promise<BotResponse>
```

Flow:
1. Trim text
2. If greeting → `welcomeService`
3. If starts with `/` → `commandRouter`
4. Try `keywordRouter`
5. Fall back to `aiRouter` (current `messageRouter`)

---

## Phase 2: Refactor Existing Adapters

### 2.1 Refactor Telegram adapter
**File:** `src/bots/telegram/index.ts`

- Keep Telegraf setup
- Remove all command logic from `commands.ts`
- Map `bot.command('start', ...)` → `dispatch('telegram', id, '/start')`
- Map `bot.on('text', ...)` → `dispatch('telegram', id, text)`
- Handle callback queries by translating `callback_data` to synthetic text/commands
- Keep Markdown parse mode

**File:** `src/bots/telegram/commands.ts` → delete or reduce to adapter-only glue

### 2.2 Refactor WhatsApp adapter
**File:** `src/bots/whatsapp/webhook.ts`

- Receive Twilio webhook
- Extract `From` (strip `whatsapp:`)
- Call `dispatch('whatsapp', from, Body)`
- Send response via `sendWhatsAppMessage`

**File:** `src/bots/whatsapp/messageHandler.ts` → delete

### 2.3 Clean up
- Delete `src/services/commandHandler.ts` (merged into shared commandRouter)
- Delete `src/services/keywordRouter.ts` (moved to shared)
- Update all imports

---

## Phase 3: Add New Channels

### 3.1 Slack adapter
**Files:**
- `src/bots/slack/index.ts` — Bolt app setup
- `src/bots/slack/messageHandler.ts` — event handler

**Steps:**
1. Install `@slack/bolt`
2. Read `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN` from env
3. Handle `app_mention` and DM `message`
4. Call `dispatch('slack', userId, text)`
5. Reply via `say()` or `client.chat.postMessage`

**Env additions:**
```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...
```

### 3.2 X (Twitter) adapter
**Files:**
- `src/bots/x/index.ts` — webhook receiver
- `src/bots/x/sendMessage.ts` — DM reply

**Steps:**
1. Install `twitter-api-v2`
2. Handle Account Activity API webhook or poll DMs
3. Call `dispatch('x', userId, text)`
4. Reply via DM API v2

**Env additions:**
```env
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_SECRET=...
X_WEBHOOK_SECRET=...
```

---

## Phase 4: Wiring & Boot

### 4.1 Update `src/index.ts`

Initialize all enabled bots:
```ts
import { createTelegramBot } from './bots/telegram';
import { createWhatsAppBot } from './bots/whatsapp';
import { createSlackBot } from './bots/slack';
import { createXBot } from './bots/x';

if (env.TELEGRAM_BOT_TOKEN) createTelegramBot();
if (env.TWILIO_ACCOUNT_SID) createWhatsAppBot(app);
if (env.SLACK_BOT_TOKEN) createSlackBot();
if (env.X_API_KEY) createXBot(app);
```

### 4.2 Update `src/config/env.ts`

Add new env vars with defaults (optional):
```ts
SLACK_BOT_TOKEN: z.string().optional(),
SLACK_SIGNING_SECRET: z.string().optional(),
SLACK_APP_TOKEN: z.string().optional(),
X_API_KEY: z.string().optional(),
X_API_SECRET: z.string().optional(),
X_ACCESS_TOKEN: z.string().optional(),
X_ACCESS_SECRET: z.string().optional(),
```

### 4.3 Update `backend/.env.example`

Add commented-out Slack/X vars.

---

## Phase 5: Testing

### 5.1 Unit tests
**File:** `src/bots/shared/__tests__/dispatcher.test.ts`

Test:
- Greeting → welcome
- `/balance xdc...` → returns balance
- `gas price` → returns gas
- Unknown → AI fallback
- `connect wallet` → prompt

### 5.2 Adapter tests
Mock each platform SDK and verify `dispatch` is called with correct platform.

### 5.3 Manual tests
- Telegram: `/start`, `hi`, `balance of xdc...`
- WhatsApp: same
- Slack: `@bot hi`, DM `balance of xdc...`
- X: DM `hi`

---

## Phase 6: Documentation

### 6.1 Update README
Add section: "Adding a New Bot Channel"

### 6.2 Add `src/bots/README.md`
```
To add a new channel:
1. Create `src/bots/<channel>/index.ts`
2. Import `dispatch` from `../shared/dispatcher`
3. Call `dispatch('<channel>', userId, text)`
4. Send response using channel SDK
5. Add env vars to `env.ts` and `.env.example`
```

---

## Commits

| Commit | Message |
|--------|---------|
| 1 | `refactor: add shared bot types and dispatcher foundation` |
| 2 | `refactor: move command and keyword routing to shared layer` |
| 3 | `refactor: thin Telegram adapter using shared dispatcher` |
| 4 | `refactor: thin WhatsApp adapter using shared dispatcher` |
| 5 | `feat: add Slack bot adapter` |
| 6 | `feat: add X (Twitter) bot adapter` |
| 7 | `chore: update env schema and .env.example for Slack/X` |
| 8 | `test: add dispatcher unit tests` |
| 9 | `docs: add bot architecture README` |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Telegram inline buttons break | Translate callbacks to synthetic commands, keep existing handlers temporarily |
| WhatsApp webhook path changes | Keep `/webhook/whatsapp` route, internal handler becomes 3 lines |
| Command behavior differences | Each command receives `platform` so it can branch if truly needed |
| Env var bloat | All new env vars are optional — bot skips channel if missing |

---

## Estimates

| Phase | Hours |
|-------|-------|
| Phase 1 (foundation) | 3-4h |
| Phase 2 (refactor Telegram/WhatsApp) | 2-3h |
| Phase 3 (Slack + X) | 4-6h |
| Phase 4 (wiring + env) | 1h |
| Phase 5 (testing) | 2-3h |
| Phase 6 (docs) | 1h |
| **Total** | **13-18h** |

---

## Next Step

Create branch `feat/unified-bot-dispatcher` from `feat/bot-erc8004` and begin Phase 1.
