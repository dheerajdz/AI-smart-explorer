import axios from 'axios';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { RESPONSE_FORMATTER_PROMPT } from './promptTemplates';
import { QueryAction } from '../../types';

// ─── Config ─────────────────────────────────────────────────

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';

const openrouterClient = axios.create({
  baseURL: OPENROUTER_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'AI-Smart-Explorer',
  },
});

// ─── Core API ───────────────────────────────────────────────

/**
 * Send a prompt to OpenRouter and return the text response.
 * Falls back to mock parser on any error.
 */
export async function askKimi(prompt: string): Promise<string> {
  logger.info('Asking OpenRouter', { promptLength: prompt.length });

  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
    logger.warn('No OPENROUTER_API_KEY configured, returning mock response');
    return mockKimiResponse(prompt);
  }

  try {
    const response = await openrouterClient.post('/chat/completions', {
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful blockchain data assistant. Always follow the output format requested by the user.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    });

    const content = response.data?.choices?.[0]?.message?.content;

    if (!content) {
      logger.error('OpenRouter returned empty content', { response: response.data });
      throw new Error('Empty response from OpenRouter');
    }

    logger.info('OpenRouter response received', { contentLength: content.length });
    return content.trim();

  } catch (error: any) {
    logger.error('OpenRouter API error', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

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
 * Development mock: simulates AI responses for testing without an API key.
 * Extracts the user message from the full prompt (after the triple quotes)
 * and returns realistic JSON based on known patterns.
 */
function mockKimiResponse(prompt: string): string {
  const userMsgMatch = prompt.match(/"""\n([\s\S]*?)\n"""$/);
  const userMessage = userMsgMatch ? userMsgMatch[1].trim() : prompt;
  const lower = userMessage.toLowerCase();

  logger.info('Mock parsing user message', { userMessage });

  const extractAddress = (msg: string): string => {
    const match = msg.match(/(0x[0-9a-fA-F]{40}|xdc[0-9a-fA-F]{40}|txdc[0-9a-fA-F]{40})/);
    return match ? match[1] : '';
  };

  const addr = extractAddress(userMessage);

  if (lower.includes('alert') || lower.includes('notify')) {
    return JSON.stringify({ action: QueryAction.CREATE_ALERT, type: 'price_threshold', condition: { operator: '<', value: 0.02, currency: 'USD' } });
  }

  if (lower.includes('wallet connected') || lower.includes('my wallet') || lower.includes('connected wallet')) {
    return JSON.stringify({ action: QueryAction.WALLET_STATUS });
  }

  if (lower.includes('help') || lower === '?') {
    return JSON.stringify({ action: QueryAction.HELP });
  }

  if (lower.includes('failed contract deploy') || lower.includes('failed deploy')) {
    return JSON.stringify({ action: QueryAction.FAILED_CONTRACT_DEPLOYMENTS, period: '7d' });
  }

  if (lower.includes('who deployed') || lower.includes('deployer')) {
    const contract = extractAddress(userMessage) || '0x123';
    return JSON.stringify({ action: QueryAction.CONTRACT_DEPLOYER, contract });
  }

  if (lower.includes('verified') || lower.includes('verification')) {
    const contract = extractAddress(userMessage) || '0x123';
    return JSON.stringify({ action: QueryAction.CONTRACT_VERIFICATION, contract });
  }

  if (lower.startsWith('tx ') || (lower.includes('transaction') && lower.includes('0x'))) {
    const txHash = extractAddress(userMessage) || '0xabc123';
    return JSON.stringify({ action: QueryAction.TRANSACTION_DETAIL, txHash });
  }

  if (lower.includes('failed transaction') || lower.includes('failed tx')) {
    return JSON.stringify({ action: QueryAction.FAILED_TRANSACTIONS, address: addr });
  }

  if (lower.includes('large transfer') || lower.includes('whale') || lower.includes('big transfer')) {
    return JSON.stringify({ action: QueryAction.LARGE_TRANSFERS, address: addr, threshold: 1000 });
  }

  if (lower.includes('activity') || lower.includes('stats') || lower.includes('overview')) {
    return JSON.stringify({ action: QueryAction.WALLET_ACTIVITY, address: addr });
  }

  if (lower.includes('token')) {
    return JSON.stringify({ action: QueryAction.TOKEN_BALANCE, address: addr });
  }

  if (lower.includes('nft')) {
    return JSON.stringify({ action: QueryAction.NFT_BALANCE, address: addr });
  }

  if (lower.includes('gas price') || lower.includes('gas')) {
    return JSON.stringify({ action: QueryAction.GAS_PRICE });
  }

  if (lower.includes('block ')) {
    const match = userMessage.match(/(\d+)/);
    const blockNumber = match ? parseInt(match[1]) : 'latest';
    return JSON.stringify({ action: QueryAction.BLOCK_INFO, blockNumber });
  }

  if (lower.includes('network stat') || lower.includes('chain stat')) {
    return JSON.stringify({ action: QueryAction.NETWORK_STATS });
  }

  if (lower.includes('list alert') || lower.includes('my alert') || lower.includes('show alert')) {
    return JSON.stringify({ action: QueryAction.LIST_ALERTS });
  }

  if (lower.includes('delete alert') || lower.includes('remove alert')) {
    return JSON.stringify({ action: QueryAction.DELETE_ALERT });
  }

  // ── Portfolio ──────────────────────────────────────────────
  if (lower.includes('add wallet') || lower.includes('track wallet')) {
    return JSON.stringify({ action: QueryAction.ADD_PORTFOLIO_WALLET, address: addr });
  }

  if (lower.includes('remove wallet') || lower.includes('stop tracking')) {
    return JSON.stringify({ action: QueryAction.REMOVE_PORTFOLIO_WALLET, address: addr });
  }

  if (lower.includes('portfolio') || lower.includes('my wallets') || lower.includes('all wallets')) {
    return JSON.stringify({ action: QueryAction.PORTFOLIO_SUMMARY });
  }

  if (lower.includes('transaction') || lower.includes('txs') || lower.includes('history')) {
    return JSON.stringify({ action: QueryAction.TRANSACTIONS, address: addr });
  }

  if (lower.includes('balance') || addr) {
    return JSON.stringify({ action: QueryAction.WALLET_BALANCE, address: addr });
  }

  return JSON.stringify({ action: QueryAction.UNKNOWN, raw: userMessage });
}
