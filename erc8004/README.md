# ERC-8004 Agent Registration

This directory contains everything needed to register Smart AI Explorer as an ERC-8004 agent.

## Files

- `agent-registration.json` — Agent metadata (services, endpoints, description)
- `register-agent.js` — Script to mint the agent NFT on-chain
- `registration-info.json` — Auto-generated after successful registration

## Quick Start

### 1. Install Dependencies

```bash
cd erc8004
npm init -y
npm install ethers dotenv
```

### 2. Prepare Your Registration File

Edit `agent-registration.json`:
- Update `name` and `description`
- Update `services[0].endpoint` with your actual Telegram bot link
- Update `image` with your bot avatar URL

### 3. Upload to IPFS

Upload `agent-registration.json` to IPFS via:
- [Pinata](https://pinata.cloud)
- [Web3.Storage](https://web3.storage)
- [NFT.Storage](https://nft.storage)

Get the CID and format as: `ipfs://QmYourCID`

### 4. Configure Environment

Add to your `../backend/.env`:

```env
# ERC-8004 Registration
PRIVATE_KEY=0x...your-wallet-private-key...
RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
AGENT_URI=ipfs://QmYourCID
ERC8004_NETWORK=sepolia
```

**Important:** Use a dedicated wallet. The private key holder owns the agent NFT.

### 5. Register

```bash
node register-agent.js
```

This mints an ERC-721 NFT on the IdentityRegistry contract. You get:
- **Agent ID** — your unique agent identifier
- **Agent Registry** string — `eip155:chainId:registryAddress`

### 6. Update Registration File

After registration, update `agent-registration.json`:

```json
"registrations": [
  {
    "agentId": 42,
    "agentRegistry": "eip155:11155111:0x8004A818BFB912233c491871b3d84c89A494BD9e"
  }
]
```

Then re-upload to IPFS and call `setAgentURI()` to update:

```bash
node update-uri.js  # Coming soon
```

## Networks

| Network | IdentityRegistry | ReputationRegistry |
|---------|-----------------|-------------------|
| Ethereum Sepolia | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| Ethereum Mainnet | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| Base Mainnet | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

**XDC Network:** Not yet deployed. Use Ethereum Sepolia for testing, or deploy contracts yourself.

## What You Get

After registration:
- ✅ Discoverable agent identity (ERC-721 NFT)
- ✅ On-chain reputation tracking
- ✅ Portable across chains
- ✅ Compatible with NFT marketplaces and explorers

## Next Steps

1. **Build reputation** — Users can submit feedback via ReputationRegistry
2. **Add validation** — Integrate TEE/zkML proofs via ValidationRegistry
3. **Cross-chain** — Register on multiple chains for broader discovery
