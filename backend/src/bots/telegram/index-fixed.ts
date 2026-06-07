import { Telegraf, Context } from 'telegraf';
import * as https from 'https';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import {
  startCommand,
  handleSignupAction,
  handleSigninAction,
  handleResendSignupOTP,
  handleResendSigninOTP,
  handleCancel,
  logoutCommand,
  handleLogoutAction,
} from './commands';
import {
  showMainMenu,
  handleNetworkSelection,
  handleMenuBalance,
  handleMenuTransactions,
  handleMenuTrack,
  handleMenuAskAI,
  handleMenuSettings,
  handleSettingsDisconnect,
  handleDisconnectConfirm,
  handleMenuBack,
  handleSettingsNotifications,
} from './walletConnect';
import { handleTelegramMessage } from './adapter';
import { portfolioCommand } from './commands/portfolioCommand';

// FIX: Force IPv4 for WSL — node-fetch hangs on IPv6
const agent = new https.Agent({ family: 4 });
const token = env.TELEGRAM_BOT_TOKEN;

// Helper to send message via native https (bypasses node-fetch hang)
export function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chat_id: chatId, text });
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        agent,
        timeout: 10000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (result.ok) {
              console.log('[bot] reply sent to', chatId);
              resolve();
            } else {
              reject(new Error(result.description));
            }
          } catch {
            reject(new Error('Invalid response'));
          }
        });
      }
    );
    req.on('error', (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.write(data);
    req.end();
  });
}

export function createBot(): Telegraf {
  const bot = new Telegraf(token, {
    telegram: { agent: agent as any },
  });

  /* -------------------- Commands -------------------- */
  bot.command('start', startCommand);
  bot.command('portfolio', portfolioCommand);
  bot.command('logout', logoutCommand);

  /* -------------------- Auth Callbacks -------------------- */
  bot.action('action_signup', handleSignupAction);
  bot.action('action_signin', handleSigninAction);
  bot.action('action_resend_signup', handleResendSignupOTP);
  bot.action('action_resend_signin', handleResendSigninOTP);
  bot.action('action_cancel', handleCancel);
  bot.action('action_logout', handleLogoutAction);

  /* -------------------- Wallet Connect Flow -------------------- */
  bot.action('connect_network_mainnet', handleNetworkSelection);
  bot.action('connect_network_testnet', handleNetworkSelection);

  /* -------------------- Main Menu -------------------- */
  bot.action('menu_balance', handleMenuBalance);
  bot.action('menu_transactions', handleMenuTransactions);
  bot.action('menu_track', handleMenuTrack);
  bot.action('menu_ask_ai', handleMenuAskAI);
  bot.action('menu_settings', handleMenuSettings);
  bot.action('menu_back', handleMenuBack);

  /* -------------------- Settings -------------------- */
  bot.action('settings_notifications', handleSettingsNotifications);
  bot.action('settings_disconnect', handleSettingsDisconnect);
  bot.action('disconnect_confirm', handleDisconnectConfirm);

  /* -------------------- Dashboard callbacks (placeholders) -------------------- */
  bot.action('dashboard_wallet', async (ctx: Context) => {
    await sendTelegramMessage(ctx.chat!.id, 'Wallet view is coming soon!');
    await ctx.answerCbQuery();
  });
  bot.action('dashboard_transactions', async (ctx: Context) => {
    await sendTelegramMessage(ctx.chat!.id, 'Transactions view is coming soon!');
    await ctx.answerCbQuery();
  });
  bot.action('dashboard_analyze', async (ctx: Context) => {
    await sendTelegramMessage(ctx.chat!.id, 'Analyze Wallet is coming soon!');
    await ctx.answerCbQuery();
  });
  bot.action('dashboard_track', async (ctx: Context) => {
    await sendTelegramMessage(ctx.chat!.id, 'Track Wallet is coming soon!');
    await ctx.answerCbQuery();
  });
  bot.action('dashboard_profile', async (ctx: Context) => {
    await sendTelegramMessage(ctx.chat!.id, 'Profile view is coming soon!');
    await ctx.answerCbQuery();
  });

  /* -------------------- Text messages -------------------- */
  bot.on('text', handleTelegramMessage);

  bot.catch((err) => {
    logger.error('Telegram bot error', { error: (err as Error).message });
  });

  return bot;
}
