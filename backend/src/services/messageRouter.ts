import { logger } from '../utils/logger';
import { commandHandler } from './commandHandler';
import { parseQuery, executeQuery, QueryResult } from './ai';

export interface RouterResponse {
  text: string;
}

/**
 * Route incoming WhatsApp/Telegram messages.
 *
 * Flow:
 *   1. If message starts with "/" → use legacy commandHandler
 *   2. Otherwise → send to AI queryParser
 *   3. Route parsed query through executeQuery (queryRouter)
 *   4. Return formatted response
 */
export async function messageRouter(
  message: string,
  userId: string
): Promise<RouterResponse> {
  const trimmedMessage = message.trim();

  logger.info('Routing message', { userId, message: trimmedMessage });

  // ─── 1. Legacy slash commands ───────────────────────────────
  if (trimmedMessage.startsWith('/')) {
    const parts = trimmedMessage.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);
    return commandHandler(command, args, userId);
  }

  // ─── 2. AI natural language parsing ─────────────────────────
  let parsed;
  try {
    parsed = await parseQuery(trimmedMessage);
  } catch (err) {
    logger.error('[messageRouter] parseQuery failed', { error: err, message: trimmedMessage });
    return { text: '❌ Sorry, I could not understand that. Try typing "help" for examples.' };
  }

  // ─── 3. Execute parsed query ────────────────────────────────
  try {
    const result: QueryResult = await executeQuery(parsed);
    return { text: result.text };
  } catch (err) {
    logger.error('[messageRouter] executeQuery failed', { action: parsed.action, error: err });
    return { text: '❌ Something went wrong while fetching data. Please try again later.' };
  }
}
