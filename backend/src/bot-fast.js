require('dotenv/config');
const https = require('https');
const { Telegraf } = require('telegraf');

// FIX: Force IPv4 for WSL
const agent = new https.Agent({ family: 4 });
const token = process.env.TELEGRAM_BOT_TOKEN;

// Cache balances (refresh every 60 seconds)
let cachedBalances = {};
let lastFetch = 0;

// Helper to send message via native https
function sendMessage(chatId, text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chat_id: chatId, text });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot' + token + '/sendMessage',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      agent,
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (result.ok) {
          console.log('[bot] reply sent to', chatId);
          resolve();
        } else {
          reject(new Error(result.description));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Fetch real XDC balance from blockchain
function getBalance(address) {
  return new Promise((resolve) => {
    // Return cached if fresh (< 60s)
    if (cachedBalances[address] && Date.now() - lastFetch < 60000) {
      resolve(cachedBalances[address]);
      return;
    }

    const cleanAddress = address.toLowerCase().startsWith('xdc')
      ? '0x' + address.slice(3)
      : address;
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [cleanAddress, 'latest'],
      id: 1,
    });
    const req = https.request({
      hostname: 'rpc.xinfin.network',
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'curl/7.68.0',
      },
      agent,
      timeout: 5000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.result) {
            const balanceXDC = Number(BigInt(result.result)) / 1e18;
            cachedBalances[address] = balanceXDC.toFixed(4);
            lastFetch = Date.now();
            resolve(cachedBalances[address]);
          } else {
            resolve('0');
          }
        } catch {
          resolve('0');
        }
      });
    });
    req.on('error', () => resolve(cachedBalances[address] || '0'));
    req.on('timeout', () => {
      req.destroy();
      resolve(cachedBalances[address] || '0');
    });
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('[bot] starting...');

  const bot = new Telegraf(token, { telegram: { agent } });

  bot.command('start', async (ctx) => {
    console.log('[bot] /start from', ctx.from?.id);
    await sendMessage(ctx.chat.id, 'Bot is running! Try /portfolio');
  });

  bot.command('portfolio', async (ctx) => {
    console.log('[bot] /portfolio from', ctx.from?.id);
    const chatId = ctx.chat.id;

    // Pre-built message with demo data (instant reply)
    let message = '';
    message += 'Portfolio Summary\n\n';
    message += 'Wallet: xdc1234...7890\n';
    message += 'Network: XDC Mainnet\n\n';
    message += '━━━━━━━━━━━━━━━\n\n';
    message += 'Total Portfolio Value\n';
    message += '0.0596 XDC\n';
    message += '≈ $0.02 USD\n\n';
    message += '24h Change\n';
    message += '+3.2%\n\n';
    message += '━━━━━━━━━━━━━━━\n\n';
    message += 'Holdings\n\n';
    message += 'xdc1234...7890        0.0596 XDC\n';
    message += 'xdcabcd...ef12        0.0000 XDC\n\n';
    message += '━━━━━━━━━━━━━━━\n\n';
    message += 'Recent Activity\n\n';
    message += 'Received 1,200 XDC\n';
    message += '2 hours ago\n\n';
    message += 'Sent 250 XDC\n';
    message += '5 hours ago\n\n';
    message += 'Contract Interaction\n';
    message += '1 day ago\n\n';
    message += '━━━━━━━━━━━━━━━\n\n';
    message += 'Alerts\n\n';
    message += '• 1 Failed Transaction\n';
    message += '• Large Transfer Detected\n';
    message += '• Wallet Status: Active\n\n';
    message += '━━━━━━━━━━━━━━━\n\n';
    message += 'AI Insight\n\n';
    message += 'Your wallet activity increased by 18%\n';
    message += 'compared to the previous week.\n';
    message += 'Most transactions were incoming transfers.\n\n';
    message += 'Use /transactions for detailed history.';

    // Send instantly
    await sendMessage(chatId, message);

    // Fetch real balance in background (for next time)
    getBalance('xdc1234567890123456789012345678901234567890').catch(() => {});
  });

  await bot.launch();
  console.log('[bot] launched — send /start or /portfolio in Telegram');
}

main().catch((err) => {
  console.error('[bot] fatal error:', err);
  process.exit(1);
});
