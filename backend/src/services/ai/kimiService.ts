import axios from 'axios';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { RESPONSE_FORMATTER_PROMPT } from './promptTemplates';
import { QueryAction } from '../../types';

// ─── Config ─────────────────────────────────────────────────

const KIMI_BASE_URL = env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
const KIMI_MODEL = env.KIMI_MODEL || 'moonshot-v1-8k';
const KIMI_API_KEY = env.KIMI_API_KEY;

const kimiClient = axios.create({
  baseURL: KIMI_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${KIMI_API_KEY}`,
  },
});

// ─── Core API ───────────────────────────────────────────────

/**
 * Send a prompt to Kimi and return the text response.
 * Falls back to a local mock if no API key is configured.
 */
export async function askKimi(prompt: string): Promise<string> {
  logger.info('Asking Kimi', { promptLength: prompt.length });

  // If no API key, return mock for development
  if (!KIMI_API_KEY || KIMI_API_KEY === 'your_kimi_api_key_here') {
    logger.warn('No KIMI_API_KEY configured, returning mock response');
    return mockKimiResponse(prompt);
  }

  try {
    const response = await kimiClient.post('/chat/completions', {
      model: KIMI_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful blockchain data assistant. Always follow the output format requested by the user.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1, // Low temperature for consistent JSON
      max_tokens: 2048,
    });

    const content = response.data?.choices?.[0]?.message?.content;

    if (!content) {
      logger.error('Kimi returned empty content', { response: response.data });
      throw new Error('Empty response from Kimi');
    }

    logger.info('Kimi response received', { contentLength: content.length });
    return content.trim();

  } catch (error: any) {
    logger.error('Kimi API error', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    // Return mock on API failure so the bot doesn't crash
    logger.warn('Falling back to mock response due to API error');
    return mockKimiResponse(prompt);
  }
}

/**
 * Format raw blockchain data into a friendly WhatsApp/Telegram message.
 */
export async function formatResponse(rawData: any): Promise<string> {
  const fullPrompt = `${RESPONSE_FORMATTER_PROMPT}\n"""\n${JSON.stringify(rawData)}\n"""`;
  return await askKimi(fullPrompt);
}

// ─── Mock Fallback ──────────────────────────────────────────

/**
 * Development mock: simulates Kimi responses for testing without an API key.
 * Extracts the user message from the full prompt (after the triple quotes)
 * and returns realistic JSON based on known patterns.
 */
function mockKimiResponse(prompt: string): string {
  // Extract user message from the prompt template
  // The prompt ends with: """\n<user message>\n"""
  const userMsgMatch = prompt.match(/"""\n([\s\S]*?)\n"""$/);
  const userMessage = userMsgMatch ? userMsgMatch[1].trim() : prompt;
  const lower = userMessage.toLowerCase();

  logger.info('Mock parsing user message', { userMessage });

  // ─── Helper: extract address ────────────────────────────────
  const extractAddress = (msg: string): string => {
    const match = msg.match(/(0x[0-9a-fA-F]{40}|xdc[0-9a-fA-F]{40}|txdc[0-9a-fA-F]{40})/);
    return match ? match[1] : '';
  };

  const addr = extractAddress(userMessage);

  // ─── 1. Alerts ──────────────────────────────────────────────
  if (lower.includes('alert') || lower.includes('notify')) {
    return JSON.stringify({ action: QueryAction.CREATE_ALERT, type: 'price_threshold', condition: { operator: '<', value: 0.02, currency: 'USD' } });
  }

  // ─── 2. Wallet status ───────────────────────────────────────
  if (lower.includes('wallet connected') || lower.includes('my wallet') || lower.includes('connected wallet')) {
    return JSON.stringify({ action: QueryAction.WALLET_STATUS });
  }

  // ─── 3. Help ────────────────────────────────────────────────
  if (lower.includes('help') || lower === '?') {
    return JSON.stringify({ action: QueryAction.HELP });
  }

  // ─── 3. Failed contract deployments ─────────────────────────
  if (lower.includes('failed contract deploy') || lower.includes('failed deploy')) {
    return JSON.stringify({ action: QueryAction.FAILED_CONTRACT_DEPLOYMENTS, period: '7d' });
  }

  // ─── 4. Contract deployer ───────────────────────────────────
  if (lower.includes('who deployed') || lower.includes('deployer')) {
    const contract = extractAddress(userMessage) || '0x123';
    return JSON.stringify({ action: QueryAction.CONTRACT_DEPLOYER, contract });
  }

  // ─── 5. Contract verification ───────────────────────────────
  if (lower.includes('verified') || lower.includes('verification')) {
    const contract = extractAddress(userMessage) || '0x123';
    return JSON.stringify({ action: QueryAction.CONTRACT_VERIFICATION, contract });
  }

  // ─── 6. Transaction detail (specific hash) ──────────────────
  if (lower.startsWith('tx ') || (lower.includes('transaction') && lower.includes('0x'))) {
    const txHash = extractAddress(userMessage) || '0xabc123';
    return JSON.stringify({ action: QueryAction.TRANSACTION_DETAIL, txHash });
  }

  // ─── 7. Failed transactions ─────────────────────────────────
  if (lower.includes('failed transaction') || lower.includes('failed tx')) {
    return JSON.stringify({ action: QueryAction.FAILED_TRANSACTIONS, address: addr });
  }

  // ─── 8. Large transfers ─────────────────────────────────────
  if (lower.includes('large transfer') || lower.includes('whale') || lower.includes('big transfer')) {
    return JSON.stringify({ action: QueryAction.LARGE_TRANSFERS, address: addr, threshold: 1000 });
  }

  // ─── 9. Wallet activity ─────────────────────────────────────
  if (lower.includes('activity') || lower.includes('stats') || lower.includes('overview')) {
    return JSON.stringify({ action: QueryAction.WALLET_ACTIVITY, address: addr });
  }

  // ─── 10. Token balance ──────────────────────────────────────
  if (lower.includes('token')) {
    return JSON.stringify({ action: QueryAction.TOKEN_BALANCE, address: addr });
  }

  // ─── 11. NFT balance ────────────────────────────────────────
  if (lower.includes('nft')) {
    return JSON.stringify({ action: QueryAction.NFT_BALANCE, address: addr });
  }

  // ─── 12. Gas price ──────────────────────────────────────────
  if (lower.includes('gas price') || lower.includes('gas')) {
    return JSON.stringify({ action: QueryAction.GAS_PRICE });
  }

  // ─── 13. Block info ─────────────────────────────────────────
  if (lower.includes('block ')) {
    const match = userMessage.match(/(\d+)/);
    const blockNumber = match ? parseInt(match[1]) : 'latest';
    return JSON.stringify({ action: QueryAction.BLOCK_INFO, blockNumber });
  }

  // ─── 14. Network stats ──────────────────────────────────────
  if (lower.includes('network stat') || lower.includes('chain stat')) {
    return JSON.stringify({ action: QueryAction.NETWORK_STATS });
  }

  // ─── 15. List alerts ────────────────────────────────────────
  if (lower.includes('list alert') || lower.includes('my alert') || lower.includes('show alert')) {
    return JSON.stringify({ action: QueryAction.LIST_ALERTS });
  }

  // ─── 16. Delete alert ───────────────────────────────────────
  if (lower.includes('delete alert') || lower.includes('remove alert')) {
    return JSON.stringify({ action: QueryAction.DELETE_ALERT });
  }

  // ─── 17. Transactions (must check BEFORE balance) ───────────
  if (lower.includes('transaction') || lower.includes('txs') || lower.includes('history')) {
    return JSON.stringify({ action: QueryAction.TRANSACTIONS, address: addr });
  }

  // ─── 18. Balance (catch-all for address mentions) ───────────
  if (lower.includes('balance') || addr) {
    return JSON.stringify({ action: QueryAction.WALLET_BALANCE, address: addr });
  }

  // Default: unknown
  return JSON.stringify({ action: QueryAction.UNKNOWN, raw: userMessage });
}
