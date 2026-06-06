import { logger } from '../utils/logger';
import { keywordRouter } from './keywordRouter';

export interface RouterResponse {
  text: string;
}

/**
 * Route incoming messages to the appropriate handler.
 *
 * NOTE: Slash commands are handled directly by each bot
 * (Telegram via bot.command(), WhatsApp via messageHandler).
 * This function only handles natural language messages.
 *
 * CURRENT: Uses keyword-based routing (fast, reliable, no API needed).
 * TODO: Re-enable AI parsing after hackathon/demo.
 */
export async function messageRouter(
  message: string,
  userId: string
): Promise<RouterResponse> {
  const trimmedMessage = message.trim();

  logger.info('Routing message', { userId, message: trimmedMessage });

  // ─── Keyword-based routing (production-ready) ───────────────
  return keywordRouter(trimmedMessage, userId);

  // ─── AI routing (disabled for now) ──────────────────────────
  // To re-enable after demo:
  // 1. Uncomment below
  // 2. Fix Kimi API key check
  // 3. Expand mock parser patterns
  // 4. Add /debug command for troubleshooting
  /*
  const { parseQuery, executeQuery } = await import('./ai');
  const { detectNetwork } = await import('../utils/network');

  const addressMatch = trimmedMessage.match(/\b(xdc[0-9a-fA-F]{40}|txdc[0-9a-fA-F]{40}|0x[0-9a-fA-F]{40})\b/);
  const detectedNetwork = addressMatch ? detectNetwork(addressMatch[0]) : 'mainnet';

  let parsed;
  try {
    parsed = await parseQuery(trimmedMessage);
  } catch (err) {
    logger.error('[messageRouter] parseQuery failed', { error: err, message: trimmedMessage });
    return { text: '❌ Sorry, I could not understand that. Try typing "help" for examples.' };
  }

  parsed.network = parsed.network || detectedNetwork;

  try {
    const result = await executeQuery(parsed);
    return { text: result.text };
  } catch (err) {
    logger.error('[messageRouter] executeQuery failed', { action: parsed.action, error: err });
    return { text: '❌ Something went wrong while fetching data. Please try again later.' };
  }
  */
}
