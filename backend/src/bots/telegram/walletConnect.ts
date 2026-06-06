import { Context, Markup } from 'telegraf';
import { logger } from '../../utils/logger';
import {
  connectWallet,
  disconnectWallet,
  getConnectedWallet,
  hasConnectedWallet,
} from '../../services/connectedWalletService';
import { ConversationStateService } from '../../services/conversation';

/* ------------------------------------------------------------------ */
/*  Wallet Connect Flow                                               */
/* ------------------------------------------------------------------ */

export async function startWalletFlow(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const connected = await hasConnectedWallet(String(telegramId), 'telegram');

  if (connected) {
    await showMainMenu(ctx);
  } else {
    await showNetworkSelection(ctx);
  }
}

/* ------------------------------------------------------------------ */
/*  Network Selection                                                 */
/* ------------------------------------------------------------------ */

async function showNetworkSelection(ctx: Context): Promise<void> {
  const text =
    `🔗 *Connect Your Wallet*\n\n` +
    `Choose your network:`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🌐 XDC Mainnet', 'connect_network_mainnet'),
      Markup.button.callback('🧪 XDC Testnet', 'connect_network_testnet'),
    ],
  ]);

  await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
}

export async function handleNetworkSelection(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const callbackData = (ctx as any).callbackQuery?.data;
  const network = callbackData === 'connect_network_testnet' ? 'testnet' : 'mainnet';

  await ConversationStateService.setState({
    step: 'enter_wallet_address',
    telegramId,
    network,
  });

  const label = network === 'testnet' ? '🧪 XDC Testnet' : '🌐 XDC Mainnet';
  await ctx.reply(
    `${label} selected.\n\nPlease enter your wallet address:`,
    Markup.removeKeyboard()
  );
  await ctx.answerCbQuery();
}

/* ------------------------------------------------------------------ */
/*  Address Input & Validation                                        */
/* ------------------------------------------------------------------ */

export async function handleWalletAddressInput(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const address = text.trim();

  const state = await ConversationStateService.getState(telegramId);

  if (!state || state.step !== 'enter_wallet_address') {
    // Not in connect flow — let other handlers deal with it
    return;
  }

  const network = state.network || 'mainnet';

  const result = await connectWallet(String(telegramId), 'telegram', address, network);

  if (result.success) {
    await ConversationStateService.clearState(telegramId);
    await ctx.reply(result.message, { parse_mode: 'Markdown' });
    await showMainMenu(ctx);
  } else {
    await ctx.reply(result.message);
    await ctx.reply('Please enter a valid wallet address:');
  }
}

/* ------------------------------------------------------------------ */
/*  Main Menu                                                         */
/* ------------------------------------------------------------------ */

export async function showMainMenu(ctx: Context): Promise<void> {
  const text =
    `🏠 *Main Menu*\n\n` +
    `What would you like to do?`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💰 Balance', 'menu_balance')],
    [Markup.button.callback('📜 Transactions', 'menu_transactions')],
    [Markup.button.callback('🔔 Track Wallet', 'menu_track')],
    [Markup.button.callback('🤖 Ask AI', 'menu_ask_ai')],
    [Markup.button.callback('⚙️ Settings', 'menu_settings')],
  ]);

  await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
}

/* ------------------------------------------------------------------ */
/*  Menu Actions                                                      */
/* ------------------------------------------------------------------ */

export async function handleMenuBalance(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const wallet = await getConnectedWallet(String(telegramId), 'telegram');
  if (!wallet) {
    await ctx.reply('⚠️ No wallet connected. Please use /start to connect.');
    await ctx.answerCbQuery();
    return;
  }

  const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
  const address = wallet.address.startsWith('0x')
    ? `${prefix}${wallet.address.slice(2)}`
    : wallet.address;

  // Import balance command dynamically to avoid circular deps
  const { cmdBalance } = await import('../../services/blockchainCommands');
  const result = await cmdBalance(address);
  await ctx.reply(result.text, { parse_mode: 'Markdown' });
  await ctx.answerCbQuery();
}

export async function handleMenuTransactions(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const wallet = await getConnectedWallet(String(telegramId), 'telegram');
  if (!wallet) {
    await ctx.reply('⚠️ No wallet connected. Please use /start to connect.');
    await ctx.answerCbQuery();
    return;
  }

  const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
  const address = wallet.address.startsWith('0x')
    ? `${prefix}${wallet.address.slice(2)}`
    : wallet.address;

  const { cmdTransactions } = await import('../../services/blockchainCommands');
  const result = await cmdTransactions(address, 5);
  await ctx.reply(result.text, { parse_mode: 'Markdown' });
  await ctx.answerCbQuery();
}

export async function handleMenuTrack(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const wallet = await getConnectedWallet(String(telegramId), 'telegram');
  if (!wallet) {
    await ctx.reply('⚠️ No wallet connected. Please use /start to connect.');
    await ctx.answerCbQuery();
    return;
  }

  const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
  const address = wallet.address.startsWith('0x')
    ? `${prefix}${wallet.address.slice(2)}`
    : wallet.address;

  const { cmdTrack } = await import('../../services/blockchainCommands');
  const result = cmdTrack(address, String(telegramId));
  await ctx.reply(result.text, { parse_mode: 'Markdown' });
  await ctx.answerCbQuery();
}

export async function handleMenuAskAI(ctx: Context): Promise<void> {
  await ctx.reply(
    '🤖 *Ask AI*\n\n' +
    'You can ask me anything about the blockchain:\n\n' +
    '• "Balance of xdc..."\n' +
    '• "Show transactions"\n' +
    '• "Gas price"\n' +
    '• "Block 12345"\n\n' +
    'What would you like to know?',
    { parse_mode: 'Markdown' }
  );
  await ctx.answerCbQuery();
}

/* ------------------------------------------------------------------ */
/*  Settings Menu                                                     */
/* ------------------------------------------------------------------ */

export async function handleMenuSettings(ctx: Context): Promise<void> {
  const text = '⚙️ *Settings*\n\nWhat would you like to do?';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔔 Notification Settings', 'settings_notifications')],
    [Markup.button.callback('❌ Disconnect Wallet', 'settings_disconnect')],
    [Markup.button.callback('⬅️ Back to Main Menu', 'menu_back')],
  ]);

  await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
  await ctx.answerCbQuery();
}

export async function handleSettingsDisconnect(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const text = '❌ *Disconnect Wallet*\n\nAre you sure you want to disconnect?';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Yes, Disconnect', 'disconnect_confirm')],
    [Markup.button.callback('❌ No, Cancel', 'menu_settings')],
  ]);

  await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
  await ctx.answerCbQuery();
}

export async function handleDisconnectConfirm(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const result = await disconnectWallet(String(telegramId), 'telegram');
  await ctx.reply(result.message, { parse_mode: 'Markdown' });

  if (result.success) {
    await ctx.reply('Use /start to connect a new wallet.');
  }
  await ctx.answerCbQuery();
}

export async function handleMenuBack(ctx: Context): Promise<void> {
  await showMainMenu(ctx);
  await ctx.answerCbQuery();
}

export async function handleSettingsNotifications(ctx: Context): Promise<void> {
  await ctx.reply(
    '🔔 *Notification Settings*\n\nComing soon!\n\n' +
    'You will be able to choose:\n' +
    '• Successful transactions\n' +
    '• Failed transactions\n' +
    '• Incoming transfers\n' +
    '• Outgoing transfers\n' +
    '• Contract interactions\n' +
    '• Large transactions only',
    { parse_mode: 'Markdown' }
  );
  await ctx.answerCbQuery();
}
