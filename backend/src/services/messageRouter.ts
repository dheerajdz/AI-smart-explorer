import { logger } from '../utils/logger';
import { keywordRouter } from './keywordRouter';
import { commandHandler } from './commandHandler';
import { parseQuery, executeQuery, QueryResult } from './ai';

export interface RouterResponse {
  text: string;
  language?: string;
}

/**
 * Route incoming messages to the appropriate handler.
 *
 * Strategy: Slash commands go to commandHandler (supports /plans, /myplan, /admin),
 * then try AI parsing (natural language), falling back to keyword router.
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
  userPreferredLanguage?: string,
  telegramId?: number
): Promise<RouterResponse> {
  const trimmedMessage = message.trim();

  logger.info('Routing message', { userId, message: trimmedMessage, userPreferredLanguage, telegramId });

  // ─── Slash commands ─────────────────────────────────────────
  if (trimmedMessage.startsWith('/')) {
    const parts = trimmedMessage.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    return commandHandler(command, args, userId, telegramId);
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
