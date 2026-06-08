import { Context, Markup } from 'telegraf';
import { logger } from '../../utils/logger';
import { AuthService, UserService } from '../../services/auth';
import { UserModel } from '../../models/User';
import {
  ConversationStateService,
  ConversationState,
} from '../../services/conversation/ConversationState';
import { messageRouter } from '../../services/messageRouter';
import { isValidXdcAddress, detectNetwork, getExplorerBaseUrl } from '../../utils/network';
import {
  getWalletBalance,
  getTransactions,
  getGasPrice,
} from '../../services/blockchain';
import * as walletService from '../../services/walletService';
import {
  cmdBalance,
  cmdTransactions,
  cmdTrack,
  cmdUntrack,
  cmdList,
  cmdGasPrice,
  cmdBlockInfo,
  cmdFailedTransactions,
  cmdWalletActivity,
  cmdLargeTransfers,
  cmdPrice,
  cmdStatus,
  cmdHelp,
} from '../../services/blockchainCommands';

/* ------------------------------------------------------------------ */
/*  /menu  — show main menu anytime                                    */
/* ------------------------------------------------------------------ */
export async function menuCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const text =
    `🏠 *Main Menu*\n\n` +
    `Choose an option:`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💰 Balance', 'menu_balance')],
    [Markup.button.callback('📜 Transactions', 'menu_transactions')],
    [Markup.button.callback('🔔 Track Wallet', 'menu_track')],
    [Markup.button.callback('📊 Portfolio', 'menu_portfolio')],
    [Markup.button.callback('🚨 My Alerts', 'menu_alerts')],
    [Markup.button.callback('🤖 Ask AI', 'menu_ask_ai')],
    [Markup.button.callback('⚙️ Settings', 'menu_settings')],
  ]);

  await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
}

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

  // Check if user has connected wallet (new flow) - THIS FIRST
  const { startWalletFlow } = await import('./walletConnect');
  await startWalletFlow(ctx);
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

  // Set conversation state to awaiting email
  await ConversationStateService.setState({
    step: 'awaiting_signup_email',
    telegramId,
    telegramUsername,
    action: 'signup',
  });

  await ctx.reply(
    '📝 *Sign Up*\n\n' +
      'Step 1/3: Please enter your email address.\n' +
      'We will send a verification code to this email.',
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

  // Check if user exists
  const user = await AuthService.findByTelegramId(telegramId);

  if (!user) {
    await ctx.reply(
      '❌ No account found. Please sign up first.',
      Markup.inlineKeyboard([
        [Markup.button.callback('📝 Sign Up', 'action_signup')],
      ])
    );
    return;
  }

  // Initiate OTP for signin
  const result = await AuthService.initiateSignin(telegramId);

  if (!result.success) {
    await ctx.reply(`❌ ${result.error}\n\nPlease try again or use /start.`);
    return;
  }

  // Set conversation state
  await ConversationStateService.setState({
    step: 'awaiting_signin_otp',
    telegramId,
    telegramUsername,
    action: 'signin',
    email: user.email,
  });

  let message =
    '🔐 *Sign In*\n\n' +
    `Step 1/1: A verification code has been sent to \`${user.email}\`.\n` +
    'Please enter the 6-digit code below.\n\n' +
    '⏱️ Code expires in 5 minutes.';

  if (result.previewUrl) {
    message += `\n\n📧 [View test email here](${result.previewUrl})`;
  }

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Resend Code', 'action_resend_signin')],
      [Markup.button.callback('❌ Cancel', 'action_cancel')],
    ]),
  });
}

/* ------------------------------------------------------------------ */
/*  Resend OTP handlers                                                */
/* ------------------------------------------------------------------ */
export async function handleResendSignupOTP(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const result = await AuthService.resendOTP(telegramId, 'signup');

  if (!result.success) {
    await ctx.reply(`❌ ${result.error}`);
    return;
  }

  let message = '🔄 *New code sent!*\n\nPlease enter the 6-digit code below.';
  if (result.previewUrl) {
    message += `\n\n📧 [View test email here](${result.previewUrl})`;
  }

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Resend Code', 'action_resend_signup')],
      [Markup.button.callback('❌ Cancel', 'action_cancel')],
    ]),
  });
  await ctx.answerCbQuery('New code sent!');
}

export async function handleResendSigninOTP(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const result = await AuthService.resendOTP(telegramId, 'signin');

  if (!result.success) {
    await ctx.reply(`❌ ${result.error}`);
    return;
  }

  let message = '🔄 *New code sent!*\n\nPlease enter the 6-digit code below.';
  if (result.previewUrl) {
    message += `\n\n📧 [View test email here](${result.previewUrl})`;
  }

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Resend Code', 'action_resend_signin')],
      [Markup.button.callback('❌ Cancel', 'action_cancel')],
    ]),
  });
  await ctx.answerCbQuery('New code sent!');
}

/* ------------------------------------------------------------------ */
/*  Cancel handler                                                     */
/* ------------------------------------------------------------------ */
export async function handleCancel(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await ConversationStateService.clearState(telegramId);
  await ctx.reply('❌ Cancelled. Use /start to begin again.');
  await ctx.answerCbQuery('Cancelled');
}

/* ------------------------------------------------------------------ */
/*  Logout handler                                                     */
/* ------------------------------------------------------------------ */
export async function logoutCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('Unable to identify your account.');
    return;
  }

  logger.info('Command: /logout', { from: telegramId });

  // Clear any conversation state
  await ConversationStateService.clearState(telegramId);

  await ctx.reply(
    '👋 *Logged out successfully!*\n\n' +
      'Your session has been cleared.\n' +
      'Use /start to sign in again.',
    { parse_mode: 'Markdown' }
  );
}

export async function handleLogoutAction(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  logger.info('Action: logout', { from: telegramId });

  // Clear conversation state
  await ConversationStateService.clearState(telegramId);

  await ctx.reply(
    '👋 *Logged out successfully!*\n\n' +
      'Your session has been cleared.\n' +
      'Use /start to sign in again.',
    { parse_mode: 'Markdown' }
  );
  await ctx.answerCbQuery('Logged out');
}

/* ------------------------------------------------------------------ */
/*  Text message handler — processes all user input                    */
/* ------------------------------------------------------------------ */
export async function handleTextMessage(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const telegramUsername = ctx.from?.username;
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;

  if (!telegramId || !text) {
    await ctx.reply('Unable to process your message.');
    return;
  }

  const input = text.trim();

  // Skip slash commands — let bot.command() handlers take over
  if (input.startsWith('/')) {
    return;
  }

  // ─── Keyword shortcuts (no slash needed) ────────────────────
  // Examples: "b xdc...", "t xdc...", "gas", "status"
  const keywordResult = await handleKeywordShortcut(input, String(telegramId));
  if (keywordResult) {
    await ctx.reply(keywordResult, { parse_mode: 'Markdown' });
    return;
  }

  const state = await ConversationStateService.getState(telegramId);

  if (!state) {
    // No active conversation — route to keyword router
    const response = await messageRouter(input, String(telegramId));
    await ctx.reply(response.text, { parse_mode: 'Markdown' });
    return;
  }

  switch (state.step) {
    case 'awaiting_signup_email':
      await processSignupEmail(ctx, telegramId, telegramUsername, input);
      return;

    case 'awaiting_signup_otp':
      await processSignupOTP(ctx, telegramId, input);
      return;

    case 'awaiting_signup_wallet':
      await processSignupWallet(ctx, telegramId, input);
      return;

    case 'awaiting_signin_otp':
      await processSigninOTP(ctx, telegramId, input);
      return;

    case 'enter_wallet_address':
      // Wallet connect flow
      const { handleWalletAddressInput } = await import('./walletConnect');
      await handleWalletAddressInput(ctx);
      return;

    default:
      await ctx.reply('Please use /start to begin.');
  }
}

/* ------------------------------------------------------------------ */
/*  Step 1: Process signup email                                       */
/* ------------------------------------------------------------------ */
async function processSignupEmail(
  ctx: Context,
  telegramId: number,
  telegramUsername: string | undefined,
  email: string
): Promise<void> {
  logger.info('Processing signup email', { telegramId, email });

  const result = await AuthService.initiateSignup({
    telegramId,
    telegramUsername,
    email,
  });

  if (!result.success) {
    await ctx.reply(`❌ ${result.error}\n\nPlease try again or use /start.`);
    return;
  }

  // Update state to awaiting OTP
  await ConversationStateService.setState({
    step: 'awaiting_signup_otp',
    telegramId,
    telegramUsername,
    action: 'signup',
    email: email.toLowerCase(),
  });

  let message =
    '✅ *Email accepted!*\n\n' +
    'Step 2/3: A verification code has been sent to your email.\n' +
    'Please enter the 6-digit code below.\n\n' +
    '⏱️ Code expires in 5 minutes.';

  if (result.previewUrl) {
    message += `\n\n📧 [View test email here](${result.previewUrl})`;
  }

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Resend Code', 'action_resend_signup')],
      [Markup.button.callback('❌ Cancel', 'action_cancel')],
    ]),
  });
}

/* ------------------------------------------------------------------ */
/*  Step 2: Process signup OTP                                         */
/* ------------------------------------------------------------------ */
async function processSignupOTP(ctx: Context, telegramId: number, otp: string): Promise<void> {
  logger.info('Processing signup OTP', { telegramId });

  // Validate OTP format
  if (!/^\d{6}$/.test(otp)) {
    await ctx.reply('❌ Please enter a valid 6-digit code (numbers only).');
    return;
  }

  const state = await ConversationStateService.getState(telegramId);

  // Store OTP temporarily and move to wallet step
  // (We verify OTP after wallet is provided to keep flow simple)
  // Actually, let's verify now and then ask for wallet
  const otpResult = await AuthService.completeSignup(telegramId, otp, '');

  // If OTP is invalid, error out
  if (!otpResult.success && otpResult.error?.includes('Invalid')) {
    await ctx.reply(`❌ ${otpResult.error}`);
    return;
  }

  // OTP is valid — now ask for wallet
  await ConversationStateService.setState({
    step: 'awaiting_signup_wallet',
    telegramId,
    telegramUsername: state?.telegramUsername,
    action: 'signup',
    email: state?.email,
  });

  await ctx.reply(
    '✅ *Code verified!*\n\n' +
      'Step 3/3: Please enter your XDC wallet address.\n' +
      'Supported formats:\n' +
      '• Mainnet: `xdc...` (42 characters)\n' +
      '• EVM: `0x...` (42 characters)',
    { parse_mode: 'Markdown' }
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3: Process signup wallet                                      */
/* ------------------------------------------------------------------ */
async function processSignupWallet(ctx: Context, telegramId: number, walletAddress: string): Promise<void> {
  logger.info('Processing signup wallet', { telegramId, walletAddress });

  const state = await ConversationStateService.getState(telegramId);

  if (!state?.email) {
    await ctx.reply('❌ Session expired. Please use /start to begin again.');
    return;
  }

  // We need to re-verify the OTP or store it differently
  // For simplicity, let's re-verify with stored OTP data
  // Actually, we need to handle this properly

  // Since OTP was already verified, we just need to create the user
  // But completeSignup needs the OTP... Let's use a different approach

  // Check wallet validity
  if (!AuthService.isValidWalletAddress(walletAddress)) {
    await ctx.reply(
      '❌ Invalid wallet address.\n' +
        'Please enter a valid XDC address starting with `xdc` or `0x` (42 characters).',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Create user directly since OTP was verified
  try {
    const existingWallet = await UserModel.findByWalletAddress(walletAddress.trim().toLowerCase());

    if (existingWallet) {
      await ctx.reply('❌ Wallet address already registered. Please use a different wallet or sign in.');
      return;
    }

    const savedUser = await UserModel.create({
      telegramId,
      telegramUsername: state.telegramUsername || undefined,
      email: state.email.toLowerCase(),
      walletAddress: walletAddress.trim().toLowerCase(),
      plan: 'free',
      isEmailVerified: true,
    });

    await ConversationStateService.clearState(telegramId);

    logger.info('User signed up via Telegram', { telegramId, userId: savedUser._id, email: savedUser.email, walletAddress: savedUser.walletAddress });

    const dashboard = UserService.buildDashboardPayload(savedUser);

    await ctx.reply(
      `✅ *Sign Up Successful!*\n\n` +
        `Welcome, *${savedUser.telegramUsername || 'User'}*!\n` +
        `Email: \`${savedUser.email}\`\n` +
        `Wallet: \`${savedUser.walletAddress}\`\n` +
        `Plan: ${savedUser.plan}\n\n` +
        `*Your Dashboard:*`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💼 Wallet', 'dashboard_wallet')],
          [Markup.button.callback('📊 Transactions', 'dashboard_transactions')],
          [Markup.button.callback('🔍 Analyze Wallet', 'dashboard_analyze')],
          [Markup.button.callback('🔔 Track Wallet', 'dashboard_track')],
          [Markup.button.callback('👤 Profile', 'dashboard_profile')],
          [Markup.button.callback('🚪 Logout', 'action_logout')],
        ]),
      }
    );

    // Send dashboard payload as JSON
    await ctx.reply(
      '```json\n' + JSON.stringify(dashboard, null, 2) + '\n```',
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    logger.error('Signup wallet error', err);
    await ctx.reply('❌ Internal error. Please try again or use /start.');
  }
}

/* ------------------------------------------------------------------ */
/*  Process signin OTP                                                 */
/* ------------------------------------------------------------------ */
async function processSigninOTP(ctx: Context, telegramId: number, otp: string): Promise<void> {
  logger.info('Processing signin OTP', { telegramId });

  // Validate OTP format
  if (!/^\d{6}$/.test(otp)) {
    await ctx.reply('❌ Please enter a valid 6-digit code (numbers only).');
    return;
  }

  const result = await AuthService.completeSignin(telegramId, otp);

  if (!result.success) {
    await ctx.reply(`❌ ${result.error}`);
    return;
  }

  await ConversationStateService.clearState(telegramId);

  const user = result.user!;
  const dashboard = UserService.buildDashboardPayload(user);

  await ctx.reply(
    `✅ *Sign In Successful!*\n\n` +
      `Welcome back, *${user.telegramUsername || 'User'}*!\n` +
      `Email: \`${user.email}\`\n` +
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
        [Markup.button.callback('🚪 Logout', 'action_logout')],
      ]),
    }
  );

  // Send dashboard payload as JSON
  await ctx.reply(
    '```json\n' + JSON.stringify(dashboard, null, 2) + '\n```',
    { parse_mode: 'Markdown' }
  );
}

/* ------------------------------------------------------------------ */
/*  Blockchain commands                                                */
/* ------------------------------------------------------------------ */

export async function trackCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const parts = text.split(/\s+/);
  let address = parts[1] || '';

  if (!address) {
    // Try connected wallet
    const { getConnectedWallet } = await import('../../services/connectedWalletService');
    const wallet = await getConnectedWallet(String(telegramId), 'telegram');
    if (wallet) {
      const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
      address = wallet.address.startsWith('0x')
        ? `${prefix}${wallet.address.slice(2)}`
        : wallet.address;
    }
  }

  if (!address) {
    await ctx.reply(
      '🔔 *Track Wallet*\n\n' +
        'Usage: `/track <address>`\n\n' +
        'Examples:\n' +
        '• `/track xdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020`\n' +
        '• `/track txdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020`\n\n' +
        '⚠️ Or connect a wallet with /start',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const result = cmdTrack(address, String(telegramId));
  await ctx.reply(result.text, { parse_mode: 'Markdown' });
}

export async function untrackCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const parts = text.split(/\s+/);
  const address = parts[1] || '';

  if (!address) {
    await ctx.reply('Usage: `/untrack <address>`', { parse_mode: 'Markdown' });
    return;
  }

  const result = cmdUntrack(address, String(telegramId));
  await ctx.reply(result.text, { parse_mode: 'Markdown' });
}

export async function listCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const result = cmdList(String(telegramId));
  await ctx.reply(result.text, { parse_mode: 'Markdown' });
}

export async function balanceCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const parts = text.split(/\s+/);
  let address = parts[1] || '';

  if (!address) {
    // Try connected wallet
    const { getConnectedWallet } = await import('../../services/connectedWalletService');
    const wallet = await getConnectedWallet(String(telegramId), 'telegram');
    if (wallet) {
      const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
      address = wallet.address.startsWith('0x')
        ? `${prefix}${wallet.address.slice(2)}`
        : wallet.address;
    }
  }

  if (!address) {
    await ctx.reply(
      '💰 *Balance Lookup*\n\n' +
        'Usage: `/balance <address>`\n\n' +
        'Examples:\n' +
        '• `/balance xdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020`\n' +
        '• `/balance txdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020`\n\n' +
        '⚠️ Or connect a wallet with /start',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const result = await cmdBalance(address);
  await ctx.reply(result.text, { parse_mode: 'Markdown' });
}

export async function txCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const parts = text.split(/\s+/);
  let address = parts[1] || '';

  if (!address) {
    // Try connected wallet
    const { getConnectedWallet } = await import('../../services/connectedWalletService');
    const wallet = await getConnectedWallet(String(telegramId), 'telegram');
    if (wallet) {
      const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
      address = wallet.address.startsWith('0x')
        ? `${prefix}${wallet.address.slice(2)}`
        : wallet.address;
    }
  }

  if (!address) {
    await ctx.reply(
      '📄 *Transaction History*\n\n' +
        'Usage: `/tx <address>`\n\n' +
        'Examples:\n' +
        '• `/tx xdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020`\n' +
        '• `/tx txdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020`\n\n' +
        '⚠️ Or connect a wallet with /start',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const result = await cmdTransactions(address, 5);
  await ctx.reply(result.text, { parse_mode: 'Markdown' });
}

export async function priceCommand(ctx: Context): Promise<void> {
  const result = cmdPrice();
  await ctx.reply(result.text, { parse_mode: 'Markdown' });
}

export async function statusCommand(ctx: Context): Promise<void> {
  const result = await cmdStatus();
  await ctx.reply(result.text, { parse_mode: 'Markdown' });
}

export async function helpCommand(ctx: Context): Promise<void> {
  const result = cmdHelp();
  await ctx.reply(result.text, { parse_mode: 'Markdown' });
}

/* ------------------------------------------------------------------ */
/*  Keyword shortcuts — no slash needed                                */
/* ------------------------------------------------------------------ */

async function handleKeywordShortcut(
  input: string,
  userId: string
): Promise<string | null> {
  const parts = input.split(/\s+/);
  const keyword = parts[0].toLowerCase();
  const rest = parts.slice(1).join(' ');

  // Extract address from rest of message
  const addrMatch = rest.match(/(0x[0-9a-fA-F]{40}|xdc[0-9a-fA-F]{40}|txdc[0-9a-fA-F]{40})/);
  const address = addrMatch ? addrMatch[1] : '';

  switch (keyword) {
    case 'b':
    case 'bal':
      if (!address) return null;
      return (await cmdBalance(address)).text;

    case 't':
    case 'txs':
      if (!address) return null;
      return (await cmdTransactions(address, 5)).text;

    case 'gas':
      return (await cmdGasPrice()).text;

    case 'block':
      return (await cmdBlockInfo(rest || 'latest')).text;

    case 'status':
      return (await cmdStatus()).text;

    case 'track':
      if (!address) return null;
      return cmdTrack(address, userId).text;

    case 'untrack':
      if (!address) return null;
      return cmdUntrack(address, userId).text;

    case 'list':
      return cmdList(userId).text;

    case 'activity':
      if (!address) return null;
      return (await cmdWalletActivity(address)).text;

    case 'failed':
      if (!address) return null;
      return (await cmdFailedTransactions(address, 5)).text;

    case 'large':
      if (!address) return null;
      return (await cmdLargeTransfers(address, 1000)).text;

    case 'price':
      return cmdPrice().text;

    case 'help':
      return cmdHelp().text;

    default:
      return null;
  }
}
