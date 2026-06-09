import axios from 'axios';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { RESPONSE_FORMATTER_PROMPT } from './promptTemplates';
import { QueryAction } from '../../types/query';

// ─── Config ─────────────────────────────────────────────────

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;

// Fallback chain: try each model in order until one works
const FALLBACK_MODELS = [
  'meta-llama/llama-3.2-3b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
];

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
 * Tries multiple models in fallback chain.
 * Falls back to mock parser on any error.
 */
export async function askKimi(prompt: string): Promise<string> {
  logger.info('Asking OpenRouter', { promptLength: prompt.length });

  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
    logger.warn('No OPENROUTER_API_KEY configured, returning mock response');
    return mockKimiResponse(prompt);
  }

  // Try each model in fallback chain
  for (const model of FALLBACK_MODELS) {
    try {
      const response = await openrouterClient.post('/chat/completions', {
        model,
        messages: [
          { role: 'system', content: 'You are a helpful blockchain data assistant. Always follow the output format requested by the user.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      });

      const content = response.data?.choices?.[0]?.message?.content;

      if (!content) {
        logger.error('OpenRouter returned empty content', { model, response: response.data });
        continue; // Try next model
      }

      logger.info('OpenRouter response received', { model, contentLength: content.length });
      return content.trim();

    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;

      // 404 = model not found, try next
      if (status === 404) {
        logger.warn(`OpenRouter model ${model} not found (404), trying next...`);
        continue;
      }

      // Other errors (401, 429, 500) — don't retry, fall back to mock
      logger.error('OpenRouter API error', { model, status, message });
      break;
    }
  }

  // All models failed or non-404 error
  logger.warn('All OpenRouter models failed, falling back to mock response');
  return mockKimiResponse(prompt);
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

  // ── Greeting ───────────────────────────────────────────────
  if (lower === 'hi' || lower === 'hello' || lower === 'hey' || lower === 'hii') {
    return JSON.stringify({ action: QueryAction.HELP });
  }

  // ── Main Menu / Help ───────────────────────────────────────
  if (
    lower.includes('main menu') ||
    lower === 'menu' ||
    lower === 'home' ||
    lower === 'start' ||
    lower.includes('help') ||
    lower === '?' ||
    lower.includes('commands') ||
    lower.includes('what can you do') ||
    lower.includes('show menu') ||
    lower.includes('options')
  ) {
    return JSON.stringify({ action: QueryAction.HELP });
  }

  // ── Cancel / Stop ──────────────────────────────────────────
  if (lower === 'cancel' || lower === 'stop' || lower === 'quit' || lower.includes('cancel')) {
    return JSON.stringify({ action: QueryAction.UNKNOWN, raw: userMessage, intent: 'cancel' });
  }

  // ── Confirmation ───────────────────────────────────────────
  if (lower === 'yes' || lower === 'no' || lower === 'confirm' || lower === 'ok' || lower === 'sure') {
    return JSON.stringify({ action: QueryAction.UNKNOWN, raw: userMessage, intent: 'confirmation' });
  }

  // ── Alerts ─────────────────────────────────────────────────
  if (lower.includes('alert') || lower.includes('notify')) {
    return JSON.stringify({ action: QueryAction.CREATE_ALERT, type: 'price_threshold', condition: { operator: '<', value: 0.02, currency: 'USD' } });
  }

  // ── Wallet Status ──────────────────────────────────────────
  if (lower.includes('wallet connected') || lower.includes('my wallet') || lower.includes('connected wallet')) {
    return JSON.stringify({ action: QueryAction.WALLET_STATUS });
  }

  // ── Failed Contract Deploys ────────────────────────────────
  if (lower.includes('failed contract deploy') || lower.includes('failed deploy')) {
    return JSON.stringify({ action: QueryAction.FAILED_CONTRACT_DEPLOYMENTS, period: '7d' });
  }

  // ── Contract Deployer ──────────────────────────────────────
  if (lower.includes('who deployed') || lower.includes('deployer')) {
    const contract = extractAddress(userMessage) || '0x123';
    return JSON.stringify({ action: QueryAction.CONTRACT_DEPLOYER, contract });
  }

  // ── Contract Verification ──────────────────────────────────
  if (lower.includes('verified') || lower.includes('verification')) {
    const contract = extractAddress(userMessage) || '0x123';
    return JSON.stringify({ action: QueryAction.CONTRACT_VERIFICATION, contract });
  }

  // ── Transaction Detail ─────────────────────────────────────
  if (lower.startsWith('tx ') || (lower.includes('transaction') && lower.includes('0x'))) {
    const txHash = extractAddress(userMessage) || '0xabc123';
    return JSON.stringify({ action: QueryAction.TRANSACTION_DETAIL, txHash });
  }

  // ── Failed Transactions ────────────────────────────────────
  if (lower.includes('failed transaction') || lower.includes('failed tx')) {
    return JSON.stringify({ action: QueryAction.FAILED_TRANSACTIONS, address: addr });
  }

  // ── Large Transfers ────────────────────────────────────────
  if (lower.includes('large transfer') || lower.includes('whale') || lower.includes('big transfer')) {
    return JSON.stringify({ action: QueryAction.LARGE_TRANSFERS, address: addr, threshold: 1000 });
  }

  // ── Wallet Activity ────────────────────────────────────────
  if (lower.includes('activity') || lower.includes('stats') || lower.includes('overview')) {
    return JSON.stringify({ action: QueryAction.WALLET_ACTIVITY, address: addr });
  }

  // ── Token Balance ──────────────────────────────────────────
  if (lower.includes('token')) {
    return JSON.stringify({ action: QueryAction.TOKEN_BALANCE, address: addr });
  }

  // ── NFT Balance ────────────────────────────────────────────
  if (lower.includes('nft')) {
    return JSON.stringify({ action: QueryAction.NFT_BALANCE, address: addr });
  }

  // ── Gas Price ──────────────────────────────────────────────
  if (lower.includes('gas price') || lower.includes('gas')) {
    return JSON.stringify({ action: QueryAction.GAS_PRICE });
  }

  // ── Block Info ─────────────────────────────────────────────
  if (lower.includes('block ')) {
    const match = userMessage.match(/(\d+)/);
    const blockNumber = match ? parseInt(match[1]) : 'latest';
    return JSON.stringify({ action: QueryAction.BLOCK_INFO, blockNumber });
  }

  // ── Network Stats ──────────────────────────────────────────
  if (lower.includes('network stat') || lower.includes('chain stat')) {
    return JSON.stringify({ action: QueryAction.NETWORK_STATS });
  }

  // ── List Alerts ────────────────────────────────────────────
  if (lower.includes('list alert') || lower.includes('my alert') || lower.includes('show alert')) {
    return JSON.stringify({ action: QueryAction.LIST_ALERTS });
  }

  // ── Delete Alert ───────────────────────────────────────────
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

  // ── Transactions ───────────────────────────────────────────
  if (lower.includes('transaction') || lower.includes('txs') || lower.includes('history')) {
    return JSON.stringify({ action: QueryAction.TRANSACTIONS, address: addr });
  }

  // ── Balance ────────────────────────────────────────────────
  if (lower.includes('balance') || addr) {
    return JSON.stringify({ action: QueryAction.WALLET_BALANCE, address: addr });
  }

  // ── Unknown ────────────────────────────────────────────────
  return JSON.stringify({ action: QueryAction.UNKNOWN, raw: userMessage });
}
