// ============================================================
// queryParser.ts
// Turns natural language into structured blockchain commands.
// This is the brain of the bot — every user message flows
// through here before hitting any blockchain API.
// ============================================================

import { logger } from '../../utils/logger';
import { askGroq } from './groqService';
import { QUERY_PARSER_PROMPT } from './promptTemplates';
import { QueryAction, VALID_QUERY_ACTIONS, ParsedQuery } from '../../types';

// Re-export for consumers that only import from services/ai
export { QueryAction, ParsedQuery } from '../../types';

// ─── Public API ─────────────────────────────────────────────

/**
 * Parse a raw user message into a structured blockchain query.
 *
 * Flow:
 *   1. Prepend QUERY_PARSER_PROMPT (examples + rules for LLM)
 *   2. Send to Groq API via askGroq()
 *   3. Strip markdown code blocks if present
 *   4. Parse JSON
 *   5. Validate the `action` field against VALID_QUERY_ACTIONS
 *   6. Return typed ParsedQuery or safe fallback
 *
 * @param userMessage Raw text from WhatsApp / Telegram / X
 * @returns ParsedQuery — guaranteed to have a valid `action`
 */
export async function parseQuery(userMessage: string): Promise<ParsedQuery> {
  logger.info('[queryParser] Parsing user message', {
    length: userMessage.length,
    preview: userMessage.slice(0, 60),
  });

  // 1. Build the full prompt
  const fullPrompt = `${QUERY_PARSER_PROMPT}\n"""\n${userMessage}\n"""`;

  // 2. Call Groq
  let rawResponse: string;
  try {
    rawResponse = await askGroq(fullPrompt);
  } catch (err) {
    logger.error('[queryParser] Groq API call failed', { error: err, userMessage });
    return fallback(userMessage);
  }

  // 3. Clean the response
  const cleaned = cleanGroqResponse(rawResponse);

  // 4. Parse JSON
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    logger.error('[queryParser] JSON parse failed', {
      raw: rawResponse,
      cleaned,
      error: err,
    });
    return fallback(userMessage);
  }

  // 5. Validate action
  if (!isValidAction(parsed.action)) {
    logger.warn('[queryParser] Unknown action from Groq', {
      action: parsed.action,
      parsed,
    });
    return fallback(userMessage);
  }

  // 6. Return typed result
  const result: ParsedQuery = {
    action: parsed.action,
    ...parsed,
  };

  logger.info('[queryParser] Parse successful', { action: result.action, address: result.address || result.wallet || 'none' });
  return result;
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Groq sometimes wraps JSON in markdown code blocks.
 * This strips those wrappers and trims whitespace.
 */
function cleanGroqResponse(raw: string): string {
  return raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
}

/**
 * Check if the action returned by Groq is in our known list.
 */
function isValidAction(action: any): action is QueryAction {
  return typeof action === 'string' && VALID_QUERY_ACTIONS.includes(action as QueryAction);
}

/**
 * Safe fallback when anything goes wrong.
 * The bot can still reply with "I didn't understand, try..."
 */
function fallback(rawMessage: string): ParsedQuery {
  return {
    action: QueryAction.UNKNOWN,
    raw: rawMessage,
  };
}
