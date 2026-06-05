import { Context, Markup } from 'telegraf';
import { logger } from '../../utils/logger';
import { AuthService, UserService } from '../../services/auth';
import {
  ConversationStateService,
  ConversationState,
} from '../../services/conversation/ConversationState';

/* ------------------------------------------------------------------ */
/*  /start  — onboarding menu                                          */
/* ------------------------------------------------------------------ */
export async function startCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  logger.info('Command: /start', { from: telegramId });

  if (!telegramId) {
    await ctx.reply('Unable to identify your Telegram account.');
    return;
  }

  // Clear any stale conversation state
  await ConversationStateService.clearState(telegramId);

  // Check if user already exists
  const existingUser = await AuthService.findByTelegramId(telegramId);

  if (existingUser) {
    const dashboard = UserService.buildDashboardPayload(existingUser);
    await ctx.reply(
      `👋 Welcome back, *${existingUser.telegramUsername || 'User'}*!\n\n` +
        `Wallet: \`${existingUser.walletAddress}\`\n` +
        `Plan: ${existingUser.plan}\n\n` +
        `*Dashboard:*`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💼 Wallet', 'dashboard_wallet')],
          [Markup.button.callback('📊 Transactions', 'dashboard_transactions')],
          [Markup.button.callback('🔍 Analyze Wallet', 'dashboard_analyze')],
          [Markup.button.callback('🔔 Track Wallet', 'dashboard_track')],
          [Markup.button.callback('👤 Profile', 'dashboard_profile')],
        ]),
      }
    );
    return;
  }

  // New user — show Sign Up / Sign In options
  await ctx.reply(
    '👋 Welcome to *Smart AI Explorer* — The Blockchain You Can Text!\n\n' +
      'Please choose an option to continue:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📝 Sign Up', 'action_signup')],
        [Markup.button.callback('🔐 Sign In', 'action_signin')],
      ]),
    }
  );
}

/* ------------------------------------------------------------------ */
/*  Callback handlers for inline buttons                               */
/* ------------------------------------------------------------------ */
export async function handleSignupAction(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const telegramUsername = ctx.from?.username;

  if (!telegramId) {
    await ctx.reply('Unable to identify your account.');
    return;
  }

  logger.info('Action: signup', { from: telegramId });

  // Set conversation state to awaiting wallet address
  await ConversationStateService.setState({
    step: 'awaiting_signup_wallet',
    telegramId,
    telegramUsername,
    action: 'signup',
  });

  await ctx.reply(
    '📝 *Sign Up*\n\n' +
      'Please send your XDC wallet address.\n' +
      'Supported formats:\n' +
      '• Mainnet: `xdc...` (42 characters)\n' +
      '• EVM: `0x...` (42 characters)',
    { parse_mode: 'Markdown' }
  );
}

export async function handleSigninAction(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const telegramUsername = ctx.from?.username;

  if (!telegramId) {
    await ctx.reply('Unable to identify your account.');
    return;
  }

  logger.info('Action: signin', { from: telegramId });

  // Set conversation state to awaiting wallet address
  await ConversationStateService.setState({
    step: 'awaiting_signin_wallet',
    telegramId,
    telegramUsername,
    action: 'signin',
  });

  await ctx.reply(
    '🔐 *Sign In*\n\n' +
      'Please send your registered XDC wallet address.\n' +
      'Format: `xdc...` or `0x...`',
    { parse_mode: 'Markdown' }
  );
}

/* ------------------------------------------------------------------ */
/*  Text message handler — processes wallet addresses                  */
/* ------------------------------------------------------------------ */
export async function handleTextMessage(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const telegramUsername = ctx.from?.username;
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;

  if (!telegramId || !text) {
    await ctx.reply('Unable to process your message.');
    return;
  }

  const state = await ConversationStateService.getState(telegramId);

  if (!state) {
    // No active conversation — show the start menu
    await startCommand(ctx);
    return;
  }

  const walletAddress = text.trim();

  if (state.step === 'awaiting_signup_wallet') {
    await processSignup(ctx, telegramId, telegramUsername, walletAddress);
    return;
  }

  if (state.step === 'awaiting_signin_wallet') {
    await processSignin(ctx, telegramId, walletAddress);
    return;
  }

  // Fallback
  await ctx.reply('Please use /start to begin.');
}

/* ------------------------------------------------------------------ */
/*  Process signup with wallet address                                 */
/* ------------------------------------------------------------------ */
async function processSignup(
  ctx: Context,
  telegramId: number,
  telegramUsername: string | undefined,
  walletAddress: string
): Promise<void> {
  logger.info('Processing signup', { telegramId, walletAddress });

  const result = await AuthService.signup({
    telegramId,
    telegramUsername,
    walletAddress,
  });

  if (!result.success) {
    await ctx.reply(`❌ ${result.error}\n\nPlease try again or use /start.`);
    return;
  }

  // Clear conversation state
  await ConversationStateService.clearState(telegramId);

  const user = result.user!;
  const dashboard = UserService.buildDashboardPayload(user);

  await ctx.reply(
    `✅ *Sign Up Successful!*\n\n` +
      `Welcome, *${user.telegramUsername || 'User'}*!\n` +
      `Wallet: \`${user.walletAddress}\`\n` +
      `Plan: ${user.plan}\n\n` +
      `*Your Dashboard:*`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('💼 Wallet', 'dashboard_wallet')],
        [Markup.button.callback('📊 Transactions', 'dashboard_transactions')],
        [Markup.button.callback('🔍 Analyze Wallet', 'dashboard_analyze')],
        [Markup.button.callback('🔔 Track Wallet', 'dashboard_track')],
        [Markup.button.callback('👤 Profile', 'dashboard_profile')],
      ]),
    }
  );

  // Send dashboard payload as JSON for the frontend/tester
  await ctx.reply(
    '```json\n' + JSON.stringify(dashboard, null, 2) + '\n```',
    { parse_mode: 'Markdown' }
  );
}

/* ------------------------------------------------------------------ */
/*  Process signin with wallet address                                 */
/* ------------------------------------------------------------------ */
async function processSignin(
  ctx: Context,
  telegramId: number,
  walletAddress: string
): Promise<void> {
  logger.info('Processing signin', { telegramId, walletAddress });

  const result = await AuthService.signin({
    telegramId,
    walletAddress,
  });

  if (!result.success) {
    await ctx.reply(`❌ ${result.error}\n\nPlease try again or use /start.`);
    return;
  }

  // Clear conversation state
  await ConversationStateService.clearState(telegramId);

  const user = result.user!;
  const dashboard = UserService.buildDashboardPayload(user);

  await ctx.reply(
    `✅ *Sign In Successful!*\n\n` +
      `Welcome back, *${user.telegramUsername || 'User'}*!\n` +
      `Wallet: \`${user.walletAddress}\`\n` +
      `Plan: ${user.plan}\n\n` +
      `*Your Dashboard:*`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('💼 Wallet', 'dashboard_wallet')],
        [Markup.button.callback('📊 Transactions', 'dashboard_transactions')],
        [Markup.button.callback('🔍 Analyze Wallet', 'dashboard_analyze')],
        [Markup.button.callback('🔔 Track Wallet', 'dashboard_track')],
        [Markup.button.callback('👤 Profile', 'dashboard_profile')],
      ]),
    }
  );

  // Send dashboard payload as JSON for the frontend/tester
  await ctx.reply(
    '```json\n' + JSON.stringify(dashboard, null, 2) + '\n```',
    { parse_mode: 'Markdown' }
  );
}

/* ------------------------------------------------------------------ */
/*  Legacy placeholder commands (kept for compatibility)               */
/* ------------------------------------------------------------------ */
export async function trackCommand(ctx: Context): Promise<void> {
  logger.info('Command: /track', { from: ctx.from?.id });
  await ctx.reply('🔔 Wallet tracking is coming soon!');
}

export async function untrackCommand(ctx: Context): Promise<void> {
  logger.info('Command: /untrack', { from: ctx.from?.id });
  await ctx.reply('🔕 Wallet untracking is coming soon!');
}

export async function listCommand(ctx: Context): Promise<void> {
  logger.info('Command: /list', { from: ctx.from?.id });
  await ctx.reply('📋 Your tracked wallets will appear here soon.');
}

export async function balanceCommand(ctx: Context): Promise<void> {
  logger.info('Command: /balance', { from: ctx.from?.id });
  await ctx.reply('💰 Balance lookup is coming soon!');
}

export async function priceCommand(ctx: Context): Promise<void> {
  logger.info('Command: /price', { from: ctx.from?.id });
  await ctx.reply('📈 Price data is coming soon!');
}

export async function statusCommand(ctx: Context): Promise<void> {
  logger.info('Command: /status', { from: ctx.from?.id });
  await ctx.reply('🌐 Network status is coming soon!');
}
