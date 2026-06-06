import { logger } from '../../utils/logger';
import { Platform, BotResponse } from './types';
import { isGreeting, generateWelcome } from './welcome';
import { commandRouter, handleAddressOnly } from './commandRouter';
import { keywordRouter } from './keywordRouter';
import { messageRouter } from '../../services/messageRouter';
import { isValidXdcAddress } from '../../utils/network';

/**
 * Unified bot dispatcher.
 *
 * All bot channels (Telegram, WhatsApp, Slack, X) send messages here.
 * This function decides whether the message is a greeting, slash command,
 * keyword query, address-only input, or natural language — and routes it.
 */
export async function dispatch(
  platform: Platform,
  userId: string,
  text: string
): Promise<BotResponse> {
  const trimmed = text.trim();

  logger.info('[dispatch] Received message', { platform, userId, text: trimmed });

  // ─── 1. Greetings ───────────────────────────────────────────
  if (isGreeting(trimmed)) {
    const welcome = await generateWelcome(platform, userId);
    logger.info('[dispatch] Greeting detected');
    return welcome;
  }

  // ─── 2. Slash commands ──────────────────────────────────────
  if (trimmed.startsWith('/')) {
    const parts = trimmed.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);
    logger.info('[dispatch] Slash command', { command });
    return commandRouter(platform, userId, command, args);
  }

  // ─── 3. Address-only message ────────────────────────────────
  const addrMatch = trimmed.match(/\b(0x[0-9a-fA-F]{40}|xdc[0-9a-fA-F]{40}|txdc[0-9a-fA-F]{40})\b/);
  if (addrMatch && trimmed.replace(addrMatch[0], '').trim().length === 0) {
    const address = addrMatch[1];
    logger.info('[dispatch] Address-only message', { address });
    if (isValidXdcAddress(address)) {
      return handleAddressOnly(platform, userId, address);
    }
    return { text: '❌ Invalid XDC address. Please check and try again.' };
  }

  // ─── 4. Keyword routing ─────────────────────────────────────
  const keywordResult = await keywordRouter(platform, userId, trimmed);
  if (keywordResult) {
    logger.info('[dispatch] Keyword match');
    return keywordResult;
  }

  // ─── 5. AI / Natural language fallback ──────────────────────
  logger.info('[dispatch] Falling back to AI routing');
  const aiResult = await messageRouter(trimmed, userId);
  return { text: aiResult.text, parseMode: 'markdown' };
}
