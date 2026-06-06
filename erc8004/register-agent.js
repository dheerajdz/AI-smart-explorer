/**
 * ERC-8004 Agent Registration Script
 * 
 * This script mints an agent identity NFT on the ERC-8004 IdentityRegistry.
 * 
 * Prerequisites:
 * 1. Set up your .env file with PRIVATE_KEY and RPC_URL
 * 2. Upload your agent-registration.json to IPFS and get the CID
 * 3. Run: node register-agent.js
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: '../backend/.env' });

// ERC-8004 IdentityRegistry ABI (minimal)
const IDENTITY_REGISTRY_ABI = [
  "function register(string agentURI) external returns (uint256 agentId)",
  "function register() external returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string calldata newURI) external",
  "function getAgentWallet(uint256 agentId) external view returns (address)",
  "function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)"
];

// Contract addresses - replace with XDC network addresses when available
// For now using Ethereum Sepolia testnet
const CONTRACTS = {
  sepolia: {
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713"
  },
  ethereum: {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"
  },
  base: {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"
  }
  // Add XDC mainnet/testnet addresses here when deployed
};

async function registerAgent() {
  // Configuration
  const NETWORK = process.env.ERC8004_NETWORK || 'sepolia';
  const AGENT_URI = process.env.AGENT_URI; // ipfs://Qm... or https://...
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const RPC_URL = process.env.RPC_URL;

  if (!PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not found in .env');
    console.log('Add: PRIVATE_KEY=0x...');
    process.exit(1);
  }

  if (!RPC_URL) {
    console.error('❌ RPC_URL not found in .env');
    console.log('Add: RPC_URL=https://...');
    process.exit(1);
  }

  if (!AGENT_URI) {
    console.error('❌ AGENT_URI not found in .env');
    console.log('Add: AGENT_URI=ipfs://Qm... or https://...');
    process.exit(1);
  }

  const contracts = CONTRACTS[NETWORK];
  if (!contracts) {
    console.error(`❌ Unknown network: ${NETWORK}`);
    console.log(`Supported: ${Object.keys(CONTRACTS).join(', ')}`);
    process.exit(1);
  }

  console.log(`🚀 Registering agent on ${NETWORK}...`);
  console.log(`📄 Agent URI: ${AGENT_URI}`);

  // Connect to network
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log(`🔑 Wallet: ${wallet.address}`);

  // Get contract instance
  const identityRegistry = new ethers.Contract(
    contracts.identityRegistry,
    IDENTITY_REGISTRY_ABI,
    wallet
  );

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error('❌ Wallet has no funds for gas');
    process.exit(1);
  }

  // Register the agent
  console.log('⏳ Minting agent NFT...');
  
  try {
    const tx = await identityRegistry.register(AGENT_URI);
    console.log(`📤 Transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    // Parse the Registered event to get agentId
    const registeredEvent = receipt.logs
      .map(log => {
        try {
          return identityRegistry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(event => event && event.name === 'Registered');

    if (registeredEvent) {
      const agentId = registeredEvent.args.agentId.toString();
      const owner = registeredEvent.args.owner;
      
      console.log('\n🎉 Agent registered successfully!');
      console.log('═══════════════════════════════════════');
      console.log(`🆔 Agent ID: ${agentId}`);
      console.log(`👤 Owner: ${owner}`);
      console.log(`🔗 Registry: ${contracts.identityRegistry}`);
      console.log(`🌐 Network: ${NETWORK}`);
      console.log(`📄 Agent URI: ${AGENT_URI}`);
      console.log('═══════════════════════════════════════');
      console.log('\n📋 Update your agent-registration.json:');
      console.log(`"registrations": [{`);
      console.log(`  "agentId": ${agentId},`);
      console.log(`  "agentRegistry": "eip155:${await provider.getNetwork().then(n => n.chainId)}:${contracts.identityRegistry}"`);
      console.log(`}]`);
      console.log('\n📋 Agent Registry string for reference:');
      console.log(`eip155:${await provider.getNetwork().then(n => n.chainId)}:${contracts.identityRegistry}`);
      
      // Save registration details
      const fs = require('fs');
      const registrationInfo = {
        agentId: agentId,
        agentRegistry: `eip155:${await provider.getNetwork().then(n => n.chainId)}:${contracts.identityRegistry}`,
        owner: owner,
        network: NETWORK,
        chainId: (await provider.getNetwork()).chainId.toString(),
        identityRegistry: contracts.identityRegistry,
        reputationRegistry: contracts.reputationRegistry,
        agentURI: AGENT_URI,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
      
      fs.writeFileSync(
        './registration-info.json',
        JSON.stringify(registrationInfo, null, 2)
      );
      console.log('\n💾 Registration details saved to registration-info.json');
    } else {
      console.log('⚠️ Could not parse agentId from transaction logs');
      console.log('Check the transaction on the block explorer');
    }

  } catch (error) {
    console.error('❌ Registration failed:', error.message);
    if (error.reason) console.error('Reason:', error.reason);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  registerAgent().catch(console.error);
}

module.exports = { registerAgent };
