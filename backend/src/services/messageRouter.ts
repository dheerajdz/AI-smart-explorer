import { logger } from '../utils/logger';
import { keywordRouter } from './keywordRouter';
import { parseQuery, executeQuery, QueryResult } from './ai';

export interface RouterResponse {
  text: string;
}

/**
 * Route incoming messages to the appropriate handler.
 *
 * Flow:
 *   1. If message starts with "/" → use keyword/command router
 *   2. Otherwise → AI natural language parsing (primary)
 *   3. Fall back to keyword router if AI fails
 */
export async function messageRouter(
  message: string,
  userId: string
): Promise<RouterResponse> {
  const trimmedMessage = message.trim();

  logger.info('Routing message', { userId, message: trimmedMessage });

  // ─── Slash commands ─────────────────────────────────────────
  if (trimmedMessage.startsWith('/')) {
    return keywordRouter(trimmedMessage, userId);
  }

  // ─── AI routing (primary) ───────────────────────────────────
  try {
    const { detectNetwork } = await import('../utils/network');

    const addressMatch = trimmedMessage.match(/\b(xdc[0-9a-fA-F]{40}|txdc[0-9a-fA-F]{40}|0x[0-9a-fA-F]{40})\b/);
    const detectedNetwork = addressMatch ? detectNetwork(addressMatch[0]) : 'mainnet';

    const parsed = await parseQuery(trimmedMessage);

    // If AI parsed successfully with a known action, execute it
    if (parsed.action !== 'unknown') {
      parsed.network = parsed.network || detectedNetwork;

      const result: QueryResult = await executeQuery(parsed);
      logger.info('[messageRouter] AI routing success', { action: parsed.action });
      return { text: result.text };
    }

    // Parsed as unknown — fall through to keyword router
    logger.info('[messageRouter] AI parsed as unknown, falling back to keyword router');
  } catch (err) {
    logger.warn('[messageRouter] AI routing failed, falling back to keyword router', { error: err });
  }

  // ─── Keyword-based routing (fallback) ───────────────────────
  return keywordRouter(trimmedMessage, userId);
}
