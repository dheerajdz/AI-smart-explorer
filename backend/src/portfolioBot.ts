import 'dotenv/config';
import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';
import * as https from 'https';

// FIX: Force IPv4 for WSL — node-fetch hangs on IPv6
const agent = new https.Agent({ family: 4 });
const token = process.env.TELEGRAM_BOT_TOKEN!;

// Helper to send message via native https (bypasses node-fetch hang)
function sendMessage(chatId: number, text: string): Promise<void> {
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

async function getBalance(address: string): Promise<string> {
  try {
    const cleanAddress = address.toLowerCase().startsWith('xdc')
      ? '0x' + address.slice(3)
      : address;

    const postData = JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [cleanAddress, 'latest'],
      id: 1,
    });

    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: 'rpc.xinfin.network',
          path: '/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'User-Agent': 'curl/7.68.0',
          },
          agent,
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              if (result.result) {
                const balanceWei = BigInt(result.result);
                const balanceXDC = Number(balanceWei) / 1e18;
                resolve(balanceXDC.toFixed(4));
              } else {
                resolve('0');
              }
            } catch {
              resolve('0');
            }
          });
        }
      );
      req.on('error', () => resolve('0'));
      req.on('timeout', () => {
        req.destroy();
        resolve('0');
      });
      req.write(postData);
      req.end();
    });
  } catch {
    return '0';
  }
}

async function main() {
  console.log('[bot] starting...');
  await mongoose.connect(
    process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-ai-explorer'
  );
  console.log('[bot] mongo connected');

  const bot = new Telegraf(token, {
    telegram: { agent: agent as any },
  });

  bot.command('start', async (ctx) => {
    console.log('[bot] /start from', ctx.from?.id);
    await sendMessage(ctx.chat!.id, 'Bot is running! Try /portfolio');
  });

  bot.command('portfolio', async (ctx) => {
    console.log('[bot] /portfolio from', ctx.from?.id);
    const telegramId = ctx.from?.id;
    const chatId = ctx.chat?.id;

    if (!telegramId || !chatId) {
      await sendMessage(chatId || 0, 'Unable to identify your account.');
      return;
    }

    try {
      const userId = String(telegramId);
      const portfolio = await mongoose.connection.db!
        .collection('portfolios')
        .findOne({ userId });

      let message = '';

      if (!portfolio || !portfolio.wallets || portfolio.wallets.length === 0) {
        // Default demo output with exact format you want
        message =
          '💼 Portfolio Summary\n\n' +
          'Wallet: xdc1234...abcd\n' +
          'Network: XDC Mainnet\n\n' +
          '━━━━━━━━━━━━━━━\n\n' +
          '💰 Total Portfolio Value\n' +
          '12,450 XDC\n' +
          '≈ $4,980 USD\n\n' +
          '📈 24h Change\n' +
          '+3.2%\n\n' +
          '━━━━━━━━━━━━━━━\n\n' +
          '🪙 Holdings\n\n' +
          'XDC        10,000 XDC\n' +
          'USDC          500 USDC\n' +
          'Other Tokens   12 Assets\n\n' +
          '━━━━━━━━━━━━━━━\n\n' +
          '📊 Recent Activity\n\n' +
          '⬇️ Received 1,200 XDC\n' +
          '2 hours ago\n\n' +
          '⬆️ Sent 250 XDC\n' +
          '5 hours ago\n\n' +
          '📜 Contract Interaction\n' +
          '1 day ago\n\n' +
          '━━━━━━━━━━━━━━━\n\n' +
          '🔔 Alerts\n\n' +
          '• 1 Failed Transaction\n' +
          '• Large Transfer Detected\n' +
          '• Wallet Status: Active\n\n' +
          '━━━━━━━━━━━━━━━\n\n' +
          '🤖 AI Insight\n\n' +
          'Your wallet activity increased by 18%\n' +
          'compared to the previous week.\n' +
          'Most transactions were incoming transfers.\n\n' +
          'Use /transactions for detailed history.';
      } else {
        // Real data output
        let total = 0;
        let holdings = '';

        for (const w of portfolio.wallets) {
          const balance = await getBalance(w.address);
          total += parseFloat(balance);
          const addr = w.address.slice(0, 10) + '...' + w.address.slice(-4);
          holdings += '• ' + addr + ': ' + balance + ' XDC\n';
        }

        message =
          '💼 Portfolio Summary\n\n' +
          'Wallets: ' +
          portfolio.wallets.length +
          '\n' +
          'Network: XDC Mainnet\n\n' +
          '━━━━━━━━━━━━━━━\n\n' +
          '💰 Total Portfolio Value\n' +
          total.toFixed(4) +
          ' XDC\n\n' +
          '🪙 Holdings\n\n' +
          holdings +
          '\n━━━━━━━━━━━━━━━\n\n' +
          'Use /transactions for detailed history.';
      }

      await sendMessage(chatId, message);
    } catch (err) {
      console.error('Portfolio command failed', err);
      await sendMessage(
        chatId,
        'Sorry, failed to load your portfolio. Please try again.'
      );
    }
  });

  // @ts-ignore
  await bot.launch();
  console.log('[bot] launched — send /start or /portfolio in Telegram');
}

main().catch((err) => {
  console.error('[bot] fatal error:', err);
  process.exit(1);
});
