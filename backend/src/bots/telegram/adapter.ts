import { Context } from 'telegraf';
import { logger } from '../../utils/logger';
import { dispatch } from '../shared';
import { setUserLanguage } from '../../services/i18nService';

export async function handleTelegramMessage(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;

  if (!telegramId || !text) {
    await ctx.reply('Unable to process your message.');
    return;
  }

  const input = text.trim();

  // Auto-detect language from Telegram locale on first interaction
  const { hasConnectedWallet } = await import('../../services/connectedWalletService');
  const isFirstInteraction = !(await hasConnectedWallet(String(telegramId), 'telegram'));
  
  if (isFirstInteraction && ctx.from?.language_code) {
    const locale = ctx.from.language_code;
    const langMap: Record<string, string> = {
      'en': 'en',
      'hi': 'hi',
      'mr': 'mr',
    };
    const detectedLang = langMap[locale] || 'en';
    
    // Set language preference
    await setUserLanguage(String(telegramId), 'telegram', detectedLang);
    logger.info('[telegram/adapter] Auto-detected language', { telegramId, locale, detectedLang });
  }

  // Skip if this is part of an active conversation state (auth/wallet connect)
  // Those are handled by the legacy commands.ts flow
  const { ConversationStateService } = await import('../../services/conversation');
  const state = await ConversationStateService.getState(telegramId);

  if (state && state.step !== 'enter_wallet_address') {
    // Let legacy handler process auth flows
    const { handleTextMessage } = await import('./commands');
    await handleTextMessage(ctx);
    return;
  }

  if (state?.step === 'enter_wallet_address') {
    // Wallet connect address input
    const { handleWalletAddressInput } = await import('./walletConnect');
    await handleWalletAddressInput(ctx);
    return;
  }

  // Route through unified dispatcher
  try {
    const response = await dispatch('telegram', String(telegramId), input);
    await ctx.reply(response.text, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('[telegram/adapter] dispatch failed', { error: err });
    await ctx.reply('Sorry, something went wrong. Please try again.');
  }
}

export async function handleTelegramCommand(ctx: Context, command: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('Unable to identify your account.');
    return;
  }

  try {
    const response = await dispatch('telegram', String(telegramId), command);
    await ctx.reply(response.text, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('[telegram/adapter] command dispatch failed', { error: err });
    await ctx.reply('Sorry, something went wrong. Please try again.');
  }
}
