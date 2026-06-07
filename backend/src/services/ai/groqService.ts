import axios from 'axios';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { RESPONSE_FORMATTER_PROMPT } from './promptTemplates';

// ─── Config ─────────────────────────────────────────────────

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_API_KEY = env.GROQ_API_KEY;
const GROQ_MODEL = env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const groqClient = axios.create({
  baseURL: GROQ_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${GROQ_API_KEY}`,
    'User-Agent': 'AI-Smart-Explorer/1.0',
  },
});

// ─── Core API ───────────────────────────────────────────────

/**
 * Send a prompt to Groq and return the text response.
 * Falls back to mock parser on any error.
 */
export async function askGroq(prompt: string): Promise<string> {
  logger.info('Asking Groq', { promptLength: prompt.length, model: GROQ_MODEL });

  if (!GROQ_API_KEY || GROQ_API_KEY === 'your_groq_api_key_here') {
    logger.warn('No GROQ_API_KEY configured');
    throw new Error('No GROQ_API_KEY configured');
  }

  const response = await groqClient.post('/chat/completions', {
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: 'You are a JSON-only API. You MUST return ONLY valid JSON. No prose, no explanations, no markdown, no greetings. Your entire response must be parseable by JSON.parse().' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 2048,
  });

  const content = response.data?.choices?.[0]?.message?.content;

  if (!content) {
    logger.error('Groq returned empty content', { response: response.data });
    throw new Error('Empty response from Groq');
  }

  logger.info('Groq response received', { contentLength: content.length });
  return content.trim();
}

/**
 * Format raw blockchain data into a friendly WhatsApp/Telegram message.
 */
export async function formatResponse(rawData: any): Promise<string> {
  const fullPrompt = `${RESPONSE_FORMATTER_PROMPT}\n"""\n${JSON.stringify(rawData)}\n"""`;
  return await askGroq(fullPrompt);
}
