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

  if (lower.includes('alert') || lower.includes('notify')) {
    return JSON.stringify({ action: QueryAction.CREATE_ALERT, type: 'price_threshold', condition: { operator: '<', value: 0.02, currency: 'USD' } });
  }

  if (lower.includes('failed contract deploy') || lower.includes('failed deploy')) {
    return JSON.stringify({ action: QueryAction.FAILED_CONTRACT_DEPLOYMENTS, period: '7d' });
  }

  if (lower.includes('balance') || lower.includes('xdc')) {
    const match = userMessage.match(/(0x[a-f0-9]+|xdc[a-f0-9]+)/i);
    const wallet = match ? match[1] : 'xdc123';
    return JSON.stringify({ action: QueryAction.WALLET_BALANCE, wallet });
  }

  if (lower.includes('who deployed') || lower.includes('deployer')) {
    const match = userMessage.match(/(0x[a-f0-9]+)/i);
    const contract = match ? match[1] : '0x123';
    return JSON.stringify({ action: QueryAction.CONTRACT_DEPLOYER, contract });
  }

  if (lower.startsWith('tx ') || lower.includes('transaction')) {
    const match = userMessage.match(/(0x[a-f0-9]+)/i);
    const txHash = match ? match[1] : '0xabc123';
    return JSON.stringify({ action: QueryAction.TRANSACTION_DETAIL, txHash });
  }

  if (lower.includes('gas price') || lower.includes('gas')) {
    return JSON.stringify({ action: QueryAction.GAS_PRICE, period: '1d' });
  }

  if (lower.includes('block ') || lower.match(/block\s+\d+/)) {
    const match = userMessage.match(/(\d+)/);
    const blockNumber = match ? parseInt(match[1]) : 12345;
    return JSON.stringify({ action: QueryAction.BLOCK_INFO, blockNumber });
  }

  if (lower.includes('token')) {
    const match = userMessage.match(/(0x[a-f0-9]+|xdc[a-f0-9]+)/i);
    const wallet = match ? match[1] : 'xdc123';
    return JSON.stringify({ action: QueryAction.TOKEN_BALANCE, wallet });
  }

  if (lower.includes('nft')) {
    const match = userMessage.match(/(0x[a-f0-9]+|xdc[a-f0-9]+)/i);
    const wallet = match ? match[1] : 'xdc123';
    return JSON.stringify({ action: QueryAction.NFT_BALANCE, wallet });
  }

  if (lower.includes('help') || lower === '?') {
    return JSON.stringify({ action: QueryAction.HELP });
  }

  // Default: unknown
  return JSON.stringify({ action: QueryAction.UNKNOWN, raw: userMessage });
}
