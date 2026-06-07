import { Platform, BotResponse } from './types';
import { hasConnectedWallet, getConnectedWallet } from '../../services/connectedWalletService';

export async function generateWelcome(platform: Platform, userId: string): Promise<BotResponse> {
  const connected = await hasConnectedWallet(userId, platform);

  if (connected) {
    const wallet = await getConnectedWallet(userId, platform);
    const address = wallet?.address ?? '';
    const networkLabel = wallet?.network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet';
    const shortAddr = address ? `${address.slice(0, 8)}...${address.slice(-6)}` : 'Unknown';

    if (platform === 'whatsapp') {
      return {
        text:
          `👋 *Welcome back!*\n\n` +
          `Your connected wallet:\n` +
          `${networkLabel} \`${shortAddr}\`\n\n` +
          `What would you like to do?\n\n` +
          `Reply with:\n` +
          `1️⃣ Balance\n` +
          `2️⃣ Transactions\n` +
          `3️⃣ Activity\n` +
          `4️⃣ Gas price\n` +
          `5️⃣ Track this wallet\n` +
          `6️⃣ Disconnect wallet`,
        parseMode: 'markdown',
      };
    }

    return {
      text:
        `👋 *Welcome back!*\n\n` +
        `Your connected wallet:\n` +
        `${networkLabel} \`${shortAddr}\`\n\n` +
        `What would you like to do?\n\n` +
        `• "Balance"\n` +
        `• "Transactions"\n` +
        `• "Activity"\n` +
        `• "Gas price"\n` +
        `• "Track this wallet"\n` +
        `• "Disconnect wallet"`,
      parseMode: 'markdown',
    };
  }

  if (platform === 'whatsapp') {
    return {
      text:
        `👋 *Welcome to Smart AI Explorer!*\n\n` +
        `I am your AI assistant for the *XDC blockchain*.\n\n` +
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
      `👋 *Welcome to Smart AI Explorer!*\n\n` +
      `I am your AI assistant for the *XDC blockchain*.\n\n` +
      `You can text me things like:\n` +
      `• "Balance of xdc..."\n` +
      `• "Show transactions"\n` +
      `• "Gas price"\n` +
      `• "Track wallet xdc..."\n\n` +
      `To get started, connect your wallet:\n` +
      `👉 Send: *connect wallet*`,
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
