import { logger } from '../../utils/logger';
import { Platform, BotResponse } from './types';
import { isGreeting, generateWelcome } from './welcome';
import { commandRouter, handleAddressOnly } from './commandRouter';
import { keywordRouter } from '../../services/keywordRouter';
import { ActivityLogModel } from '../../models/ActivityLog';

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
    await ActivityLogModel.create({
      userId,
      platform,
      action: 'greeting',
      input: trimmed,
      output: welcome.text.substring(0, 200),
    });
    return welcome;
  }

  // ─── 2. Slash commands ──────────────────────────────────────
  if (trimmed.startsWith('/')) {
    const parts = trimmed.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);
    logger.info('[dispatch] Slash command', { command });
    const response = await commandRouter(platform, userId, command, args);
    await ActivityLogModel.create({
      userId,
      platform,
      action: 'command',
      input: trimmed,
      output: response.text.substring(0, 200),
      metadata: { command, args },
    });
    return response;
  }

  // ─── 3. AI / Natural language routing (DISABLED for now) ────
  // TODO: Re-enable when Groq NLU pipeline is fully tested
  logger.info('[dispatch] AI routing disabled, using keyword fallback');

  // ─── 4. Keyword routing (fallback) ──────────────────────────
  const keywordResult = await keywordRouter(trimmed, userId, platform);
  if (keywordResult) {
    logger.info('[dispatch] Keyword match');
    await ActivityLogModel.create({
      userId,
      platform,
      action: 'keyword',
      input: trimmed,
      output: keywordResult.text.substring(0, 200),
    });
    return keywordResult;
  }

  // ─── 5. Final fallback ──────────────────────────────────────
  return {
    text: "🤖 I didn't understand that. Type /help to see what I can do.",
  };
}

export async function logWalletConnect(
  platform: Platform,
  userId: string,
  address: string,
  success: boolean
): Promise<void> {
  await ActivityLogModel.create({
    userId,
    platform,
    action: success ? 'wallet_connect' : 'wallet_connect_failed',
    input: address,
    metadata: { address, success },
  });
}

export async function logWalletDisconnect(
  platform: Platform,
  userId: string,
  success: boolean
): Promise<void> {
  await ActivityLogModel.create({
    userId,
    platform,
    action: success ? 'wallet_disconnect' : 'wallet_disconnect_failed',
    metadata: { success },
  });
}

export async function logTrackWallet(
  platform: Platform,
  userId: string,
  address: string
): Promise<void> {
  await ActivityLogModel.create({
    userId,
    platform,
    action: 'track_wallet',
    input: address,
    metadata: { address },
  });
}

export async function logUntrackWallet(
  platform: Platform,
  userId: string,
  address: string
): Promise<void> {
  await ActivityLogModel.create({
    userId,
    platform,
    action: 'untrack_wallet',
    input: address,
    metadata: { address },
  });
}
