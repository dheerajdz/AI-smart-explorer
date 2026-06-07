import { logger } from '../utils/logger';
import { keywordRouter } from './keywordRouter';
import { parseQuery, executeQuery, QueryResult } from './ai';

export interface RouterResponse {
  text: string;
  language?: string;
}

/**
 * Route incoming messages to the appropriate handler.
 *
 * NOTE: Slash commands are handled directly by each bot
 * (Telegram via bot.command(), WhatsApp via messageHandler).
 * This function only handles natural language messages.
 *
 * Strategy: Try AI parsing first (natural language), fall back to
 * keyword router if AI fails or is unavailable.
 *
 * Language Flow:
 *   1. Detect language from message
 *   2. Parse query with language context
 *   3. Execute query
 *   4. Return response with language for translation
 */
export async function messageRouter(
  message: string,
  userId: string,
  userPreferredLanguage?: string
): Promise<RouterResponse> {
  const trimmedMessage = message.trim();

  logger.info('Routing message', { userId, message: trimmedMessage, userPreferredLanguage });

  // ─── Slash commands ─────────────────────────────────────────
  if (trimmedMessage.startsWith('/')) {
    return keywordRouter(trimmedMessage, userId);
  }

  // ─── AI routing (primary) ───────────────────────────────────
  try {
    const { detectNetwork } = await import('../utils/network');

    const addressMatch = trimmedMessage.match(/\b(xdc[0-9a-fA-F]{40}|txdc[0-9a-fA-F]{40}|0x[0-9a-fA-F]{40})\b/);
    const detectedNetwork = addressMatch ? detectNetwork(addressMatch[0]) : 'mainnet';

    // Parse with language detection
    const parsed = await parseQuery(trimmedMessage, userPreferredLanguage);

    // If AI parsed successfully with a known action, execute it
    if (parsed.action !== 'unknown') {
      parsed.network = parsed.network || detectedNetwork;

      const result = await executeQuery(parsed);
      logger.info('[messageRouter] AI routing success', { action: parsed.action, language: parsed.language });
      return { text: result.text, language: parsed.language };
    }

    // Parsed as unknown — fall through to keyword router
    logger.info('[messageRouter] AI parsed as unknown, falling back to keyword router');
  } catch (err) {
    logger.warn('[messageRouter] AI routing failed, falling back to keyword router', { error: err });
  }

  // ─── Keyword-based routing (fallback) ───────────────────────
  const keywordResult = await keywordRouter(trimmedMessage, userId);
  return { ...keywordResult, language: userPreferredLanguage || 'en' };
}
