# AI-Blockchain Integration Plan

> **Status:** Planning Phase — No code changes made  
> **Branch:** feat/blockchain-layer (with merged AI parser)  
> **Date:** June 2026

---

## 1. Current Architecture Map

### 1.1 End-to-End Message Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                       │
│  WhatsApp Message    OR    Telegram Message    OR    HTTP API Call          │
└────────────────────┬────────────────────────────┬───────────────────────────┘
                     │                            │
                     ▼                            ▼
┌────────────────────────────┐      ┌─────────────────────────────────────┐
│  WhatsApp Bot              │      │  Telegram Bot                       │
│  src/bots/whatsapp/        │      │  src/bots/telegram/                 │
│  • webhook.ts              │      │  • index.ts (createBot)             │
│  • messageHandler.ts       │      │  • commands.ts (auth + placeholders)│
│  • sendMessage.ts          │      │                                     │
└────────────┬───────────────┘      └──────────────┬──────────────────────┘
             │                                      │
             │   Both call                          │
             │   messageRouter()                    │
             ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         messageRouter.ts                                    │
│  Flow:                                                                      │
│  1. Message starts with "/" → commandHandler(command, args, userId)        │
│  2. Natural language → parseQuery() → executeQuery()                        │
└────────────────────┬────────────────────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────────────────┐
│ commandHandler  │    │  AI Pipeline                │
│ (Legacy)        │    │  src/services/ai/           │
│                 │    │                             │
│ • /help         │    │  ┌─────────────────────┐    │
│ • /status       │    │  │ queryParser.ts      │    │
│ • /track        │    │  │ • askKimi()         │    │
│ • /untrack      │    │  │ • Clean markdown    │    │
│ • /list         │    │  │ • Validate action   │    │
│                 │    │  └──────────┬──────────┘    │
│ Uses:           │    │             │               │
│ walletService   │    │             ▼               │
│ inMemoryStore   │    │  ┌─────────────────────┐    │
└─────────────────┘    │  │ queryRouter.ts      │    │
                       │  │ • Switch on action  │    │
                       │  │ • Call blockchain   │    │
                       │  │ • Format response   │    │
                       │  └──────────┬──────────┘    │
                       │             │               │
                       │             ▼               │
                       │  ┌─────────────────────┐    │
                       │  │ Blockchain Service  │    │
                       │  │ src/services/blockchain   │
                       │  │ • xdcscanService.ts │    │
                       │  │ • blockscoutService │    │
                       │  └──────────┬──────────┘    │
                       └─────────────┼───────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Explorer APIs                                       │
│  • XDCScan Mainnet: https://api.xdcscan.io/api                              │
│  • XDCScan Testnet: NOT CONFIGURED (hardcoded to mainnet)                   │
│  • Blockscout: Stub only (returns empty data)                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Entry Points Summary

| Entry Point | File | Flow | Auth Check |
|---|---|---|---|
| **WhatsApp Webhook** | `bots/whatsapp/webhook.ts` → `messageHandler.ts` | `messageRouter()` | ❌ None |
| **Telegram Commands** | `bots/telegram/index.ts` | `commands.ts` handlers | ✅ Yes (signup/signin flow) |
| **Telegram Text** | `bots/telegram/commands.ts` → `handleTextMessage()` | Auth conversation state | ✅ Yes (conversation FSM) |
| **HTTP /chat** | `routes/chatRoutes.ts` | `parseQuery()` only | ❌ None |
| **HTTP /health** | `routes/health.ts` | Static response | ❌ None |
| **HTTP /auth/** | `routes/auth.ts` | Signup/signin controllers | N/A |

### 1.3 Key Observation: Two Separate Worlds

```
TELEGRAM (Auth World)                    WHATSAPP (Open World)
─────────────────────                    ─────────────────────
/start → Signup/Signin                   Any message → messageRouter()
  ↓                                         ↓
OTP Flow                                    ↓
  ↓                                    parseQuery()
Dashboard                                     ↓
  ↓                                    executeQuery()
Placeholder commands                          ↓
(/track, /balance = "coming soon")      Blockchain API
```

**Critical Gap:** Telegram's `handleTextMessage()` ONLY handles auth conversation states. After login, any natural language query falls through to `startCommand()` — it does NOT route to the AI parser.

---

## 2. Capability Matrix

### 2.1 Query Type × Component Status

| Query Type | Parser (Kimi) | Router | Blockchain Service | Formatter | Overall Status |
|---|---|---|---|---|---|
| **Wallet Balance** | ✅ Parses `wallet_balance` | ✅ Calls `getWalletBalance()` | ✅ XDCScan `balance` API | ❌ Hardcoded template | ⚠️ Partial |
| **Wallet Activity** | ✅ Parses `wallet_activity` | ✅ Calls `getWalletActivity()` | ✅ XDCScan `txlist` + stats | ❌ Hardcoded template | ⚠️ Partial |
| **Transaction Detail** | ✅ Parses `transaction_detail` | ⚠️ Stub — returns "coming soon" | ❌ Not implemented | N/A | ❌ Missing |
| **Failed Transactions** | ✅ Parses `failed_transactions` | ⚠️ Stub — returns "coming soon" | ❌ Not implemented | N/A | ❌ Missing |
| **Failed Contract Deploys** | ✅ Parses `failed_contract_deployments` | ⚠️ Stub — returns "coming soon" | ❌ Not implemented | N/A | ❌ Missing |
| **Contract Deployer** | ✅ Parses `contract_deployer` | ⚠️ Stub — returns "coming soon" | ❌ Not implemented | N/A | ❌ Missing |
| **Contract Verification** | ✅ Parses `contract_verification` | ⚠️ Stub — returns "coming soon" | ❌ Not implemented | N/A | ❌ Missing |
| **Large Transfers** | ✅ Parses `large_transfers` | ✅ Calls `getLargeTransfers()` | ✅ XDCScan `txlist` + filter | ❌ Hardcoded template | ⚠️ Partial |
| **Gas Price** | ✅ Parses `gas_price` | ⚠️ Stub — returns "coming soon" | ❌ Not implemented | N/A | ❌ Missing |
| **Block Info** | ✅ Parses `block_info` | ⚠️ Stub — returns "coming soon" | ❌ Not implemented | N/A | ❌ Missing |
| **Network Stats** | ✅ Parses `network_stats` | ⚠️ Stub — returns "coming soon" | ❌ Not implemented | N/A | ❌ Missing |
| **Token Balance** | ✅ Parses `token_balance` | ⚠️ Stub — returns "coming soon" | ❌ Not implemented | N/A | ❌ Missing |
| **NFT Balance** | ✅ Parses `nft_balance` | ⚠️ Stub — returns "coming soon" | ❌ Not implemented | N/A | ❌ Missing |
| **Create Alert** | ✅ Parses `create_alert` | ⚠️ Fake — returns "Alert Created" | ❌ Not implemented | N/A | ❌ Missing |
| **List Alerts** | ✅ Parses `list_alerts` | ⚠️ Fake — returns "no alerts" | ❌ Not implemented | N/A | ❌ Missing |
| **Delete Alert** | ✅ Parses `delete_alert` | ⚠️ Fake — returns "Deleted" | ❌ Not implemented | N/A | ❌ Missing |
| **Help** | ✅ Parses `help` | ✅ Returns help text | N/A | ✅ Hardcoded | ✅ Working |
| **Unknown** | ✅ Fallback | ✅ Returns suggestions | N/A | ✅ Hardcoded | ✅ Working |

### 2.2 Legend

| Symbol | Meaning |
|---|---|
| ✅ | Fully implemented and working |
| ⚠️ | Partially implemented — works but has gaps |
| ❌ | Stub/placeholder — not actually functional |
| N/A | Not applicable for this query type |

### 2.3 Working vs Stub Breakdown

```
┌────────────────────────────────────────────────────┐
│ FULLY WORKING (3/18 queries)                        │
│ • Wallet Balance                                    │
│ • Wallet Activity                                   │
│ • Large Transfers                                   │
│ • Help / Unknown                                    │
├────────────────────────────────────────────────────┤
│ PARTIALLY WORKING (0/18)                            │
│ (None — working ones lack formatter integration)    │
├────────────────────────────────────────────────────┤
│ STUBS / MISSING (14/18 queries)                     │
│ • Transaction Detail                                │
│ • Failed Transactions                               │
│ • Failed Contract Deployments                       │
│ • Contract Deployer                                 │
│ • Contract Verification                             │
│ • Gas Price                                         │
│ • Block Info                                        │
│ • Network Stats                                     │
│ • Token Balance                                     │
│ • NFT Balance                                       │
│ • Create Alert                                      │
│ • List Alerts                                       │
│ • Delete Alert                                      │
└────────────────────────────────────────────────────┘
```

---

## 3. Integration Gaps

### 3.1 Missing Handlers (queryRouter.ts)

| Handler | What's Needed | Complexity |
|---|---|---|
| `handleTransactionDetail()` | Fetch tx by hash from XDCScan `txlist` and filter, or use `eth_getTransactionByHash` RPC | Low |
| `handleFailedTransactions()` | Fetch txlist, filter by `txreceipt_status === '0'` | Low |
| `handleTokenBalance()` | XDCScan `tokenbalance` API (module=account, action=tokenbalance) | Low |
| `handleGasPrice()` | XDCScan `gastracker` API or `eth_gasPrice` RPC | Low |
| `handleBlockInfo()` | XDCScan `proxy` module `eth_getBlockByNumber` | Low |
| `handleNetworkStats()` | Aggregate multiple APIs or use RPC `net_peerCount`, `eth_blockNumber` | Medium |
| `handleContractDeployer()` | Find contract creation tx (tx with `to === ''` for that address) | Medium |
| `handleContractVerification()` | XDCScan `contract` module `getabi` or `getsourcecode` | Low |
| `handleFailedContractDeployments()` | Scan txlist for failed contract creations (`isError === '1'` + `to === ''`) | Medium |
| `handleNftBalance()` | XDCScan `tokennfttx` API or ERC-721 enumeration | Medium |
| `handleCreateAlert()` | Save to MongoDB `Alert` collection | Medium |
| `handleListAlerts()` | Query MongoDB `Alert` by userId | Low |
| `handleDeleteAlert()` | Delete from MongoDB `Alert` by ID | Low |

### 3.2 Missing Blockchain Methods (xdcscanService.ts)

| Method | XDCScan API Endpoint | Use Case |
|---|---|---|
| `getTransactionByHash()` | `module=account&action=txlist` + filter | Transaction detail |
| `getTokenBalance()` | `module=account&action=tokenbalance` | ERC-20 balances |
| `getGasPrice()` | `module=gastracker&action=gasoracle` OR `module=proxy&action=eth_gasPrice` | Gas estimates |
| `getBlockByNumber()` | `module=proxy&action=eth_getBlockByNumber` | Block info |
| `getContractABI()` | `module=contract&action=getabi` | Contract verification |
| `getContractSource()` | `module=contract&action=getsourcecode` | Contract verification |
| `getTokenNFTTx()` | `module=account&action=tokennfttx` | NFT transfers |
| `getInternalTxs()` | `module=account&action=txlistinternal` | Contract deployer tracing |

### 3.3 Missing Network/Testnet Support

**Current State:**
```typescript
// xdcscanService.ts — HARDCODED to mainnet
const XDCSCAN_BASE_URL = env.XDCSCAN_API || 'https://api.xdcscan.io/api';
```

**What's Missing:**
1. **No testnet URL in env config** — `XDCSCAN_TESTNET_API` not in `env.ts` schema
2. **No network parameter** — `getWalletBalance(address)` doesn't accept `network`
3. **No address prefix detection** — `xdc...` vs `txdc...` not checked anywhere in AI pipeline
4. **No network field in ParsedQuery** — `queryParser.ts` doesn't extract or pass network
5. **No explorer link differentiation** — All links point to `xdcscan.io` regardless of network

**Where Detection Should Happen:**
```
User Message: "Balance of txdcA7A0..."
                    ↓
            messageRouter.ts
                    ↓
            [NEW] detectNetwork(address)
                    ↓
            parseQuery() — currently has no network awareness
                    ↓
            [NEW] inject network into ParsedQuery
                    ↓
            executeQuery(parsed) — pass network to handlers
                    ↓
            getWalletBalance(address, network)
                    ↓
            xdcscanClient — switch baseURL based on network
                    ↓
            Response includes correct explorer link
```

### 3.4 Missing Auth Integration

**Current State:**
- Telegram: Auth system works (OTP → MongoDB user)
- WhatsApp: No auth — `messageRouter()` uses phone number as `userId`
- AI Pipeline: `messageRouter()` receives `userId: string` but never checks if user is authenticated
- Wallet tracking: In-memory store (`inMemoryStore.ts`) — not tied to MongoDB `User` or `Wallet` models
- Alerts: MongoDB `Alert` model exists but no service layer

**Gaps:**
1. **No auth gate on AI queries** — Anyone can query blockchain data via WhatsApp or `/chat` endpoint
2. **Wallet tracking not persisted** — Tracked wallets lost on restart (in-memory only)
3. **No user-scoped queries** — "My balance" doesn't resolve to authenticated user's wallet
4. **Telegram post-auth flow broken** — After login, natural language queries don't reach AI parser
5. **Alert system orphaned** — `Alert` model has `userId` field but no service creates/reads alerts

### 3.5 Missing Alert Integration

| Component | Status | Issue |
|---|---|---|
| `Alert` MongoDB model | ✅ Exists | Has `userId`, `walletId`, `type`, `condition`, `threshold` |
| Alert service | ❌ Missing | No `AlertService.ts` to CRUD alerts |
| Alert checking in cron | ❌ Missing | `cron/jobs.ts` is a placeholder |
| Alert notification | ❌ Missing | `telegramNotify.ts` and `whatsappNotify.ts` are stubs |
| Wallet poller | ❌ Missing | `walletPoller.ts` doesn't exist |

### 3.6 Duplicate Logic

| Duplicate | Location 1 | Location 2 | Resolution |
|---|---|---|---|
| Wallet validation | `AuthService.isValidWalletAddress()` | Should be in `utils/network.ts` | Consolidate to `utils/network.ts` |
| Balance fetching | `xdcscanService.getWalletBalance()` | `commands.ts` has `/balance` placeholder | Wire `/balance` command to real service |
| Transaction listing | `xdcscanService.getTransactions()` | `commands.ts` has `/track` placeholder | Wire commands to AI pipeline |
| Kimi service | `services/ai/kimiService.ts` | `services/kimiService.ts` (old) | Delete old `services/kimiService.ts` |
| Blockscout | `services/blockchain/blockscoutService.ts` | Not used anywhere | Remove or implement |

### 3.7 Architectural Risks

| Risk | Severity | Description |
|---|---|---|
| **Kimi API dependency** | High | Every natural language query requires Kimi API call (~1-3s latency). Mock fallback works but returns limited actions. |
| **No caching layer** | Medium | Repeated identical queries (e.g., "balance of xdc123") hit XDCScan API every time. No Redis caching for blockchain data. |
| **Testnet API unavailable** | High | XDCScan testnet API (`api-testnet.xdcscan.io`) returned 404 in testing. Need Blockscout fallback. |
| **Auth bypass for WhatsApp** | Medium | WhatsApp messages go straight to `messageRouter()` with no auth check. Open data access. |
| **In-memory wallet store** | Medium | Tracked wallets lost on restart. No migration path to MongoDB `Wallet` model. |
| **Telegram post-auth dead end** | High | After login, natural language messages are ignored (auth FSM only). Users can't use AI features. |
| **Formatter not used** | Low | `formatResponse()` (Kimi-powered) exists but handlers use hardcoded templates. Inconsistent UX. |

---

## 4. Testnet Strategy

### 4.1 Current Testnet State

```
User sends: "Balance of txdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020"
                    ↓
            parseQuery() → {"action": "wallet_balance", "wallet": "txdcA7A0..."}
                    ↓
            executeQuery() → handleWalletBalance()
                    ↓
            getWalletBalance("txdcA7A0...")
                    ↓
            xdcscanClient calls: https://api.xdcscan.io/api?address=txdcA7A0...
                    ↓
            ❌ FAILS — XDCScan mainnet doesn't recognize txdc... addresses
```

### 4.2 Required Testnet Flow

```
User sends: "Balance of txdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020"
                    ↓
            messageRouter()
                    ↓
            [NEW] detectNetwork("txdcA7A0...") → "testnet"
                    ↓
            parseQuery() → {"action": "wallet_balance", "wallet": "txdcA7A0..."}
                    ↓
            [NEW] Augment: parsed.network = "testnet"
                    ↓
            executeQuery(parsed)
                    ↓
            handleWalletBalance(parsed)
                    ↓
            getWalletBalance("txdcA7A0...", "testnet")
                    ↓
            xdcscanClient uses baseURL:
              network === "testnet"
                ? "https://api-testnet.xdcscan.io/api"
                : "https://api.xdcscan.io/api"
                    ↓
            Response includes explorer link:
              network === "testnet"
                ? "https://testnet.xdcscan.com/tx/..."
                : "https://xdcscan.io/tx/..."
```

### 4.3 Testnet Implementation Points

| Layer | Change | File |
|---|---|---|
| **Env Config** | Add `XDCSCAN_TESTNET_API` to schema | `config/env.ts` |
| **Network Utils** | Create `detectNetwork()`, `getExplorerUrl()` | `utils/network.ts` (NEW) |
| **Parser** | No change needed — address passes through | `ai/queryParser.ts` |
| **Router** | Accept optional `network` param, pass to handlers | `ai/queryRouter.ts` |
| **Message Router** | Detect network from address, inject into context | `messageRouter.ts` |
| **Blockchain Service** | Add `network` param to all functions | `blockchain/xdcscanService.ts` |
| **Response** | Include correct explorer links | Each handler in `queryRouter.ts` |

### 4.4 Testnet API Reality Check

From verification testing:

| Endpoint | Result |
|---|---|
| `https://api-testnet.xdcscan.io/api` | ❌ 404 Not Found |
| `https://testnet.xdcscan.com/api` | ❌ "Invalid API URL endpoint" |
| `https://api.apothem.xdcscan.io/api` | ❌ Empty response |
| `https://apothem.blockscout.com/api` | ❌ 404 (previously known working) |

**Recommendation:** Use **Blockscout for testnet** as fallback:
- Mainnet: XDCScan (`api.xdcscan.io`)
- Testnet: Blockscout Apothem (`apothem.blockscout.com/api`)

---

## 5. Recommended Implementation Order

### Priority Framework

| Priority | Criteria |
|---|---|
| **P0 (Critical)** | Blocks demo, core PS requirement, user-facing breakage |
| **P1 (High)** | Important for demo, expected by users, easy win |
| **P2 (Medium)** | Nice to have, production readiness, technical debt |
| **P3 (Low)** | Future work, edge cases, polish |

### Roadmap

#### Phase 1: Fix Critical Breakage (P0)
**Goal:** Make the bot actually usable for demo

| # | Task | Why P0 |
|---|---|---|
| 1.1 | **Wire Telegram post-auth to AI parser** | Currently, logged-in Telegram users can't use natural language queries. The auth FSM blocks all text messages. |
| 1.2 | **Implement real `/balance`, `/track`, `/tx` commands** | Commands in `commands.ts` return "coming soon". Users expect these to work. |
| 1.3 | **Add testnet support to blockchain service** | PS explicitly requires testnet + mainnet. Currently txdc... addresses fail. |
| 1.4 | **Implement `handleTransactionDetail()`** | "Tx 0xabc..." is a core blockchain explorer feature. Currently stubbed. |

#### Phase 2: Core Blockchain Features (P1)
**Goal:** Fulfill PS requirements for hackathon

| # | Task | Why P1 |
|---|---|---|
| 2.1 | **Implement `handleFailedTransactions()`** | PS: "Show failed transactions for address" |
| 2.2 | **Implement `handleFailedContractDeployments()`** | PS: "Show failed contract deploys this week" |
| 2.3 | **Implement `handleGasPrice()`** | Common user request, XDCScan has API |
| 2.4 | **Implement `handleBlockInfo()`** | Basic explorer feature |
| 2.5 | **Implement `handleTokenBalance()`** | ERC-20 tokens are common on XDC |

#### Phase 3: Auth Integration (P2)
**Goal:** Connect auth system to blockchain features

| # | Task | Why P2 |
|---|---|---|
| 3.1 | **Persist tracked wallets to MongoDB** | Currently in-memory only. Lost on restart. |
| 3.2 | **Link wallet tracking to authenticated user** | `Wallet` model has `userId` field but is unused. |
| 3.3 | **Add auth middleware to WhatsApp /chat endpoint** | Currently open access. |
| 3.4 | **Implement user-scoped queries** | "My balance" should resolve to authenticated user's wallet. |

#### Phase 4: Alert System (P2)
**Goal:** Complete the monitoring feature

| # | Task | Why P2 |
|---|---|---|
| 4.1 | **Create `AlertService`** | CRUD for MongoDB `Alert` collection |
| 4.2 | **Implement real `handleCreate/List/DeleteAlert()`** | Currently fake responses |
| 4.3 | **Build wallet poller cron job** | Check tracked wallets for new transactions |
| 4.4 | **Wire notification service** | `telegramNotify.ts` and `whatsappNotify.ts` are stubs |

#### Phase 5: Production Polish (P3)
**Goal:** Clean up architecture, remove debt

| # | Task | Why P3 |
|---|---|---|
| 5.1 | **Remove duplicate `kimiService.ts`** | Old file at `services/kimiService.ts` |
| 5.2 | **Remove or implement Blockscout** | Currently stubbed, unused |
| 5.3 | **Add Redis caching for blockchain data** | Reduce API calls, improve latency |
| 5.4 | **Use `formatResponse()` for all handlers** | Consistent AI-powered formatting |
| 5.5 | **Implement remaining stubs** | NFT, contract deployer, network stats, contract verification |

---

## 6. Problem Statement Coverage

### 6.1 PS Requirement Mapping

| PS Requirement | Parser | Router | Blockchain Method | Formatter | Status |
|---|---|---|---|---|---|
| "Show balance of xdc123..." | ✅ `wallet_balance` | ✅ `handleWalletBalance()` | ✅ `getWalletBalance()` | ⚠️ Hardcoded | ⚠️ Works |
| "Show balance of txdc123..." | ✅ `wallet_balance` | ✅ `handleWalletBalance()` | ❌ No testnet support | N/A | ❌ Fails |
| "Show activity for xdc123..." | ✅ `wallet_activity` | ✅ `handleWalletActivity()` | ✅ `getWalletActivity()` | ⚠️ Hardcoded | ⚠️ Works |
| "Tx 0xabc..." | ✅ `transaction_detail` | ⚠️ Stub | ❌ Missing | N/A | ❌ Missing |
| "Show failed transactions for xdc123..." | ✅ `failed_transactions` | ⚠️ Stub | ❌ Missing | N/A | ❌ Missing |
| "Show failed contract deploys last week" | ✅ `failed_contract_deployments` | ⚠️ Stub | ❌ Missing | N/A | ❌ Missing |
| "Who deployed 0xabc...?" | ✅ `contract_deployer` | ⚠️ Stub | ❌ Missing | N/A | ❌ Missing |
| "Is 0xabc... verified?" | ✅ `contract_verification` | ⚠️ Stub | ❌ Missing | N/A | ❌ Missing |
| "Large transfers from xdc123..." | ✅ `large_transfers` | ✅ `handleLargeTransfers()` | ✅ `getLargeTransfers()` | ⚠️ Hardcoded | ⚠️ Works |
| "Gas price now" | ✅ `gas_price` | ⚠️ Stub | ❌ Missing | N/A | ❌ Missing |
| "Block 12345" | ✅ `block_info` | ⚠️ Stub | ❌ Missing | N/A | ❌ Missing |
| "Network stats" | ✅ `network_stats` | ⚠️ Stub | ❌ Missing | N/A | ❌ Missing |
| "Token balance of xdc123..." | ✅ `token_balance` | ⚠️ Stub | ❌ Missing | N/A | ❌ Missing |
| "NFTs owned by xdc123..." | ✅ `nft_balance` | ⚠️ Stub | ❌ Missing | N/A | ❌ Missing |
| "Alert me when XDC drops below $0.02" | ✅ `create_alert` | ⚠️ Fake | ❌ Missing | N/A | ❌ Missing |
| "Show my alerts" | ✅ `list_alerts` | ⚠️ Fake | ❌ Missing | N/A | ❌ Missing |
| "Delete alert #1" | ✅ `delete_alert` | ⚠️ Fake | ❌ Missing | N/A | ❌ Missing |

### 6.2 PS Coverage Summary

```
┌─────────────────────────────────────────────────────────────┐
│ PROBLEM STATEMENT REQUIREMENTS                               │
├─────────────────────────────────────────────────────────────┤
│ ✅ Fully Working (3/17)                                     │
│   • Wallet Balance (mainnet only)                           │
│   • Wallet Activity (mainnet only)                          │
│   • Large Transfers (mainnet only)                          │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ Partial (0/17)                                          │
├─────────────────────────────────────────────────────────────┤
│ ❌ Missing (14/17)                                         │
│   • All testnet queries                                     │
│   • Transaction Detail                                      │
│   • Failed Transactions                                     │
│   • Failed Contract Deployments                             │
│   • Contract Deployer                                       │
│   • Contract Verification                                   │
│   • Gas Price                                               │
│   • Block Info                                              │
│   • Network Stats                                           │
│   • Token Balance                                           │
│   • NFT Balance                                             │
│   • All Alert operations                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Final Architecture Proposal

### 7.1 Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │   WhatsApp   │  │   Telegram   │  │   HTTP API   │                      │
│  │   (Twilio)   │  │   (Bot API)  │  │   (Express)  │                      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                      │
└─────────┼─────────────────┼─────────────────┼──────────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BOT LAYER                                       │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  WhatsApp Handler           │  │  Telegram Handler                    │  │
│  │  • webhook.ts               │  │  • commands.ts (auth commands)       │  │
│  │  • messageHandler.ts        │  │  • handleTextMessage()               │  │
│  │                             │  │    ├─ Auth FSM (signup/signin)       │  │
│  │                             │  │    └─ [NEW] AI messageRouter()       │  │
│  └─────────────┬───────────────┘  └──────────────────┬───────────────────┘  │
│                │                                      │                       │
│                │         Both use                     │                       │
│                └─────────────┬────────────────────────┘                       │
│                              ▼                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ROUTER LAYER                                       │
│                         messageRouter.ts                                     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  1. Detect network from address (xdc... / txdc... / 0x...)         │    │
│  │  2. If starts with "/" → commandHandler() (legacy)                 │    │
│  │  3. Else → parseQuery() → executeQuery()                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AI LAYER                                        │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │  queryParser.ts │───▶│  queryRouter.ts │───▶│  Blockchain Service     │  │
│  │                 │    │                 │    │  (xdcscan/blockscout)   │  │
│  │ • askKimi()     │    │ • Switch action │    │                         │  │
│  │ • Clean JSON    │    │ • Call service  │    │ • getWalletBalance()    │  │
│  │ • Validate      │    │ • Format text   │    │ • getTransactions()     │  │
│  └─────────────────┘    └─────────────────┘    │ • getTokenBalance()     │  │
│                                                │ • getGasPrice()         │  │
│                                                │ • getBlockInfo()        │  │
│                                                │ • [NEW] getTxDetail()   │  │
│                                                └─────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXPLORER API LAYER                                   │
│                                                                              │
│  ┌──────────────────────────┐    ┌──────────────────────────────────────┐   │
│  │  XDCScan Mainnet         │    │  Blockscout Testnet (Apothem)        │   │
│  │  api.xdcscan.io          │    │  apothem.blockscout.com              │   │
│  │                          │    │                                      │   │
│  │ • balance                │    │ • balance                            │   │
│  │ • txlist                 │    │ • txlist                             │   │
│  │ • tokenbalance           │    │ • tokenbalance                       │   │
│  │ • gastracker             │    │ • gastracker                         │   │
│  │ • proxy (eth_*)          │    │ • proxy (eth_*)                      │   │
│  └──────────────────────────┘    └──────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FORMATTER / RESPONSE                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [OPTIONAL] formatResponse() — Kimi-powered formatting              │    │
│  │  OR hardcoded templates for speed                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Response with correct explorer links:                              │    │
│  │  • Mainnet: https://xdcscan.io/tx/{hash}                            │    │
│  │  • Testnet: https://testnet.xdcscan.com/tx/{hash}                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUPPORTING SERVICES                                  │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │     AUTH     │  │    ALERT     │  │     CRON     │  │    CACHE     │   │
│  │              │  │              │  │              │  │              │   │
│  │ • OTPService │  │ • AlertModel │  │ • Poll every │  │ • Redis      │   │
│  │ • AuthService│  │ • AlertService│ │   2 min      │  │ • Cache API  │   │
│  │ • UserModel  │  │ • Conditions │  │ • Check new  │  │   responses  │   │
│  │              │  │ • Notify     │  │   txs        │  │ • TTL 5 min  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                              │
│  Storage: MongoDB (users, wallets, alerts) + Redis (sessions, cache)       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Data Flow by Scenario

#### Scenario A: Natural Language Query (WhatsApp)
```
User: "Balance of xdcA7A0..."
  → WhatsApp webhook
  → messageHandler(from, body)
  → messageRouter("Balance of xdcA7A0...", from)
  → detectNetwork("xdcA7A0...") → "mainnet"
  → parseQuery("Balance of xdcA7A0...")
    → askKimi(QUERY_PARSER_PROMPT + message)
    → {"action": "wallet_balance", "wallet": "xdcA7A0..."}
  → executeQuery({action, wallet, network: "mainnet"})
  → handleWalletBalance(parsed)
  → getWalletBalance("xdcA7A0...", "mainnet")
  → XDCScan API: api.xdcscan.io/api?module=account&action=balance
  → {balance: "1250000000000000000", balanceXDC: "1.25"}
  → Format: "💰 Wallet Balance\n\nAddress: xdcA7A0...\nBalance: 1.25 XDC"
  → sendWhatsAppMessage(from, text)
```

#### Scenario B: Natural Language Query (Telegram, Authenticated)
```
User: "Show my transactions"
  → Telegram text event
  → handleTextMessage(ctx)
  → [NEW] Check if user is authenticated
  → Yes → messageRouter("Show my transactions", telegramId)
  → parseQuery("Show my transactions")
    → Kimi returns: {"action": "wallet_activity", "wallet": "my_wallet"}
  → [NEW] Resolve "my_wallet" to authenticated user's walletAddress
  → executeQuery({action, wallet: user.walletAddress, network})
  → handleWalletActivity(parsed)
  → getWalletActivity(user.walletAddress, network)
  → XDCScan API
  → Format response
  → ctx.reply(text)
```

#### Scenario C: Slash Command (Both Platforms)
```
User: "/track xdcA7A0..."
  → Telegram: bot.command('track', trackCommand)
  → WhatsApp: messageRouter detects "/" prefix
  → commandHandler('/track', ['xdcA7A0...'], userId)
  → [NEW] Check auth (if required)
  → walletService.trackWallet(userId, 'xdcA7A0...')
  → [NEW] Persist to MongoDB Wallet collection
  → Return: "✅ Wallet tracking enabled"
```

#### Scenario D: Alert Trigger (Cron)
```
Cron: Every 2 minutes
  → walletPoller.ts
  → For each tracked wallet:
    → getTransactions(wallet, network)
    → Compare with last seen tx hash (Redis)
    → If new tx found:
      → Build notification message
      → sendTelegramNotification(chatId, message)
      → sendWhatsAppNotification(phone, message)
    → Update last seen tx hash in Redis
```

### 7.3 Auth Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│ AUTH CHECK MATRIX                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Query Type          │  Requires Auth?  │  Reason           │
│  ────────────────────┼──────────────────┼────────────────── │
│  Balance (any addr)  │  ❌ No           │  Public data       │
│  Transactions        │  ❌ No           │  Public data       │
│  Gas Price           │  ❌ No           │  Public data       │
│  Block Info          │  ❌ No           │  Public data       │
│  Network Stats       │  ❌ No           │  Public data       │
│  ────────────────────┼──────────────────┼────────────────── │
│  Track Wallet        │  ✅ Yes          │  User-scoped       │
│  Untrack Wallet      │  ✅ Yes          │  User-scoped       │
│  List My Wallets     │  ✅ Yes          │  User-scoped       │
│  Create Alert        │  ✅ Yes          │  User-scoped       │
│  List Alerts         │  ✅ Yes          │  User-scoped       │
│  Delete Alert        │  ✅ Yes          │  User-scoped       │
│  "My balance"        │  ✅ Yes          │  Needs user wallet │
│  ────────────────────┼──────────────────┼────────────────── │
│  /signup, /signin    │  N/A             │  Auth flow itself  │
│  /logout             │  ✅ Yes          │  Needs session     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 MongoDB Schema Usage

| Collection | Current Usage | Target Usage |
|---|---|---|
| `users` | ✅ Auth (signup/signin) | ✅ Auth + user profile |
| `wallets` | ❌ Unused (schema exists) | ✅ Track wallets per user |
| `alerts` | ❌ Unused (schema exists) | ✅ Store alert conditions |
| `queryHistory` | ❌ Unused (schema exists) | ⚠️ Optional: query logging |

### 7.5 Redis Usage

| Key Pattern | Current | Target |
|---|---|---|
| `conv:{telegramId}` | ✅ Conversation state (auth FSM) | ✅ Keep |
| `otp:{telegramId}:{purpose}` | ✅ OTP storage | ✅ Keep |
| `wallet:lastTx:{address}` | ❌ Missing | ✅ Track last seen tx for polling |
| `cache:balance:{address}` | ❌ Missing | ⚠️ Optional: API response cache |
| `cache:txlist:{address}` | ❌ Missing | ⚠️ Optional: API response cache |

---

## 8. Files to Modify (Implementation Checklist)

### Phase 1: Critical Fixes

| File | Change | Lines |
|---|---|---|
| `src/bots/telegram/commands.ts` | Wire `handleTextMessage()` to `messageRouter()` when no auth state | ~20 |
| `src/bots/telegram/commands.ts` | Implement real `trackCommand`, `balanceCommand`, etc. | ~100 |
| `src/utils/network.ts` | **NEW** — `detectNetwork()`, `isValidAddress()`, `getExplorerUrl()` | ~50 |
| `src/config/env.ts` | Add `XDCSCAN_TESTNET_API` | ~2 |
| `src/services/blockchain/xdcscanService.ts` | Add `network` param to all functions | ~50 |
| `src/services/ai/queryRouter.ts` | Implement `handleTransactionDetail()` | ~30 |

### Phase 2: Core Features

| File | Change | Lines |
|---|---|---|
| `src/services/blockchain/xdcscanService.ts` | Add `getTransactionByHash()`, `getTokenBalance()`, `getGasPrice()`, `getBlockByNumber()` | ~150 |
| `src/services/ai/queryRouter.ts` | Implement remaining handlers | ~200 |
| `src/services/messageRouter.ts` | Inject network into parsed query | ~10 |

### Phase 3: Auth Integration

| File | Change | Lines |
|---|---|---|
| `src/services/walletService.ts` | Use MongoDB `Wallet` model instead of in-memory | ~50 |
| `src/services/storage/inMemoryStore.ts` | Deprecate or redirect to MongoDB | ~20 |
| `src/services/messageRouter.ts` | Add auth check for protected queries | ~30 |

### Phase 4: Alerts

| File | Change | Lines |
|---|---|---|
| `src/services/alert/AlertService.ts` | **NEW** — CRUD for alerts | ~100 |
| `src/services/ai/queryRouter.ts` | Wire alert handlers to AlertService | ~30 |
| `src/cron/walletPoller.ts` | **NEW** — Poll wallets, check alerts | ~80 |
| `src/cron/jobs.ts` | Schedule wallet poller | ~10 |
| `src/services/notification/telegramNotify.ts` | Implement real notification | ~20 |
| `src/services/notification/whatsappNotify.ts` | Implement real notification | ~20 |

---

## 9. Summary

### What's Working Today
- ✅ AI query parser (Kimi) correctly identifies 18 query types
- ✅ 3 blockchain handlers work end-to-end (balance, activity, large transfers)
- ✅ Auth system (OTP email signup/signin) works on Telegram
- ✅ WhatsApp webhook receives and routes messages
- ✅ REST API `/chat` parses queries

### What's Broken Today
- ❌ Telegram users can't use AI after logging in (auth FSM blocks everything)
- ❌ All slash commands return "coming soon"
- ❌ Testnet addresses fail (no testnet API routing)
- ❌ 14/18 query handlers are stubs
- ❌ Wallet tracking is in-memory only (lost on restart)
- ❌ Alert system is completely non-functional
- ❌ No caching (repeated queries hit APIs every time)

### Recommended First 3 Tasks
1. **Wire Telegram post-auth to AI parser** — Unlocks the entire AI layer for Telegram users
2. **Implement real `/balance`, `/track`, `/tx` commands** — Makes the bot immediately usable
3. **Add testnet support** — Fulfills core PS requirement

---

*End of Integration Plan. No code changes made.*
