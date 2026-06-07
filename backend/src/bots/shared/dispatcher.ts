import { logger } from '../../utils/logger';
import { Platform, BotResponse } from './types';
import { isGreeting, generateWelcome } from './welcome';
import { commandRouter, handleAddressOnly } from './commandRouter';
import { keywordRouter } from './keywordRouter';
import { messageRouter } from '../../services/messageRouter';
import { isValidXdcAddress } from '../../utils/network';
import { ActivityLogModel } from '../../models/ActivityLog';
import { connectWallet, disconnectWallet } from '../../services/connectedWalletService';

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

  // ─── 3. Address-only message ────────────────────────────────
  const addrMatch = trimmed.match(/\b(0x[0-9a-fA-F]{40}|xdc[0-9a-fA-F]{40}|txdc[0-9a-fA-F]{40})\b/);
  if (addrMatch && trimmed.replace(addrMatch[0], '').trim().length === 0) {
    const address = addrMatch[1];
    logger.info('[dispatch] Address-only message', { address });
    if (isValidXdcAddress(address)) {
      const response = await handleAddressOnly(platform, userId, address);
      await ActivityLogModel.create({
        userId,
        platform,
        action: 'connect_wallet',
        input: trimmed,
        output: response.text.substring(0, 200),
        metadata: { address },
      });
      return response;
    }
    await ActivityLogModel.create({
      userId,
      platform,
      action: 'invalid_address',
      input: trimmed,
      output: 'Invalid address',
    });
    return { text: '❌ Invalid XDC address. Please check and try again.' };
  }

  // ─── 4. Keyword routing ─────────────────────────────────────
  const keywordResult = await keywordRouter(platform, userId, trimmed);
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

  // ─── 5. AI / Natural language fallback ──────────────────────
  logger.info('[dispatch] Falling back to AI routing');
  const aiResult = await messageRouter(trimmed, userId);
  await ActivityLogModel.create({
    userId,
    platform,
    action: 'ai_query',
    input: trimmed,
    output: aiResult.text.substring(0, 200),
  });
  return { text: aiResult.text, parseMode: 'markdown' };
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
