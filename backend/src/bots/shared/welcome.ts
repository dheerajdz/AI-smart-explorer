import { Platform, BotResponse } from './types';
import { hasConnectedWallet, getConnectedWallet } from '../../services/connectedWalletService';
import { getUserTranslation } from '../../services/i18nService';

export async function generateWelcome(platform: Platform, userId: string): Promise<BotResponse> {
  const connected = await hasConnectedWallet(userId, platform);
  const t = await getUserTranslation(userId, platform);

  if (connected) {
    const wallet = await getConnectedWallet(userId, platform);
    const address = wallet?.address ?? '';
    const networkLabel = wallet?.network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet';
    const shortAddr = address ? `${address.slice(0, 8)}...${address.slice(-6)}` : 'Unknown';

    if (platform === 'whatsapp') {
      return {
        text:
          `👋 *${t.welcome_title}*\n\n` +
          `${t.welcome_connected}:\n` +
          `${networkLabel} \`${shortAddr}\`\n\n` +
          `What would you like to do?\n\n` +
          `Reply with:\n` +
          `1️⃣ ${t.btn_view_balance}\n` +
          `2️⃣ ${t.btn_view_transactions}\n` +
          `3️⃣ ${t.cmd_activity_title}\n` +
          `4️⃣ ${t.cmd_gas_title}\n` +
          `5️⃣ ${t.btn_track_wallet}\n` +
          `6️⃣ Disconnect wallet`,
        parseMode: 'markdown',
      };
    }

    return {
      text:
        `👋 *${t.welcome_title}*\n\n` +
        `${t.welcome_connected}:\n` +
        `${networkLabel} \`${shortAddr}\`\n\n` +
        `What would you like to do?\n\n` +
        `• "${t.btn_view_balance}"\n` +
        `• "${t.btn_view_transactions}"\n` +
        `• "${t.cmd_activity_title}"\n` +
        `• "${t.cmd_gas_title}"\n` +
        `• "${t.btn_track_wallet}"\n` +
        `• "Disconnect wallet"\n\n` +
        `💎 *Billing:* /subscription · /upgrade · /billing`,
      parseMode: 'markdown',
    };
  }

  if (platform === 'whatsapp') {
    return {
      text:
        `👋 *${t.welcome_title}*\n\n` +
        `${t.welcome_description}\n\n` +
        `You can text me things like:\n` +
        `• "Balance of xdc..."\n` +
        `• "Show transactions"\n` +
        `• "Gas price"\n` +
        `• "Track wallet xdc..."\n\n` +
        `To get started, connect your wallet:\n\n` +
        `Reply with:\n` +
        `1️⃣ Mainnet\n` +
        `2️⃣ Testnet`,
      parseMode: 'markdown',
    };
  }

  return {
    text:
      `👋 *${t.welcome_title}*\n\n` +
      `${t.welcome_description}\n\n` +
      `You can text me things like:\n` +
      `• "Balance of xdc..."\n` +
      `• "Show transactions"\n` +
      `• "Gas price"\n` +
      `• "Track wallet xdc..."\n\n` +
      `To get started, connect your wallet:\n` +
      `👉 Send: *connect wallet*\n\n` +
      `💎 *Billing:* /subscription · /upgrade · /billing`,
    parseMode: 'markdown',
  };
}

export function isGreeting(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return (
    lower === 'hi' ||
    lower === 'hii' ||
    lower === 'hello' ||
    lower === 'hey' ||
    lower === 'start' ||
    lower === 'welcome'
  );
}
