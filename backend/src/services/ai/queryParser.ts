// ============================================================
// queryParser.ts
// Turns natural language into structured blockchain commands.
// This is the brain of the bot — every user message flows
// through here before hitting any blockchain API.
// ============================================================

import { logger } from '../../utils/logger';
import { askKimi } from './kimiService';
import { QUERY_PARSER_PROMPT } from './promptTemplates';
import { QueryAction, VALID_QUERY_ACTIONS, ParsedQuery } from '../../types';
import { detectLanguage, extractLanguageAndMessage } from '../i18n/languageDetector';

// Re-export for consumers that only import from services/ai
export { QueryAction, ParsedQuery } from '../../types';

// ─── Public API ─────────────────────────────────────────────

/**
 * Parse a raw user message into a structured blockchain query.
 *
 * Flow:
 *   1. Detect language from user message
 *   2. Extract clean message (remove /lang commands)
 *   3. Prepend QUERY_PARSER_PROMPT (examples + rules for Kimi)
 *   4. Send to Kimi API via askKimi()
 *   5. Strip markdown code blocks if present
 *   6. Parse JSON
 *   7. Validate the `action` field against VALID_QUERY_ACTIONS
 *   8. Attach detected language to result
 *   9. Return typed ParsedQuery or safe fallback
 *
 * @param userMessage Raw text from WhatsApp / Telegram / X
 * @param userPreferredLanguage Optional user preference from DB
 * @returns ParsedQuery — guaranteed to have a valid `action` and `language`
 */
export async function parseQuery(
  userMessage: string,
  userPreferredLanguage?: string
): Promise<ParsedQuery> {
  logger.info('[queryParser] Parsing user message', {
    length: userMessage.length,
    preview: userMessage.slice(0, 60),
  });

  // 1. Detect language and extract clean message
  const { language: detectedLang, message: cleanMessage } = extractLanguageAndMessage(userMessage);

  // Use user preference if available, otherwise detected language
  const language = (userPreferredLanguage || detectedLang) as any;

  logger.info('[queryParser] Language detected', { detectedLang, language, cleanMessage: cleanMessage.slice(0, 40) });

  // 2. Build the full prompt with clean message
  const fullPrompt = `${QUERY_PARSER_PROMPT}\n"""\n${cleanMessage}\n"""`;

  // 3. Call Kimi
  let rawResponse: string;
  try {
    rawResponse = await askKimi(fullPrompt);
  } catch (err) {
    logger.error('[queryParser] Kimi API call failed', { error: err, userMessage });
    return fallback(userMessage, language);
  }

  // 4. Clean the response
  const cleaned = cleanKimiResponse(rawResponse);

  // 5. Parse JSON
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    logger.error('[queryParser] JSON parse failed', {
      raw: rawResponse,
      cleaned,
      error: err,
    });
    return fallback(userMessage, language);
  }

  // 6. Validate action
  if (!isValidAction(parsed.action)) {
    logger.warn('[queryParser] Unknown action from Kimi', {
      action: parsed.action,
      parsed,
    });
    return fallback(userMessage, language);
  }

  // 7. Return typed result with language attached
  const result: ParsedQuery = {
    action: parsed.action,
    language,
    ...parsed,
  };

  logger.info('[queryParser] Parse successful', { action: result.action, language: result.language, address: result.address || result.wallet || 'none' });
  return result;
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Kimi sometimes wraps JSON in markdown code blocks.
 * This strips those wrappers and trims whitespace.
 */
function cleanKimiResponse(raw: string): string {
  return raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
}

/**
 * Check if the action returned by Kimi is in our known list.
 */
function isValidAction(action: any): action is QueryAction {
  return typeof action === 'string' && VALID_QUERY_ACTIONS.includes(action as QueryAction);
}

/**
 * Safe fallback when anything goes wrong.
 * The bot can still reply with "I didn't understand, try..."
 */
function fallback(rawMessage: string, language: string = 'en'): ParsedQuery {
  return {
    action: QueryAction.UNKNOWN,
    language: language as any,
    raw: rawMessage,
  };
}
