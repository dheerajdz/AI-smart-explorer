require('dotenv').config();
const { Telegraf } = require('telegraf');
const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function sendMessage(chatId, text) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
      family: 4,
      timeout: 5000
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(data);
    req.end();
  });
}

async function fetchBalance(address) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [address, 'latest'],
      id: 1
    });
    const req = https.request({
      hostname: 'rpc.xinfin.network',
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': 'SmartExplorer/1.0'
      },
      family: 4,
      timeout: 8000
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const bal = parseInt(json.result || '0', 16) / 1e18;
          resolve(bal.toFixed(4));
        } catch { resolve('0.0000'); }
      });
    });
    req.on('error', () => resolve('0.0000'));
    req.on('timeout', () => { req.destroy(); resolve('0.0000'); });
    req.write(data);
    req.end();
  });
}

const bot = new Telegraf(BOT_TOKEN);

bot.command('start', async (ctx) => {
  await sendMessage(ctx.from.id, 'Bot is running!');
});

bot.command('portfolio', async (ctx) => {
  const userId = ctx.from.id.toString();
  const wallet = '0xfD553CBDf8cA05868B53E26D8596D4A6feb43094';
  
  // Send loading message
  await sendMessage(userId, 'Fetching real balance from XDC blockchain...');
  
  // Fetch real balance
  const balance = await fetchBalance(wallet);
  const valueUSD = (parseFloat(balance) * 0.4).toFixed(2);
  
  const msg = `<b>Portfolio Summary</b>\n\n` +
    `Wallet: ${wallet}\n` +
    `Network: XDC Mainnet\n\n` +
    `<b>Balance:</b> ${balance} XDC\n` +
    `<b>Value:</b> $${valueUSD} USD\n\n` +
    `<b>Holdings:</b>\n` +
    `Main: ${balance} XDC ($${valueUSD})\n\n` +
    `<b>AI Insight:</b>\n` +
    `Your portfolio is active. Consider staking for 8-12% APY.`;

  await sendMessage(userId, msg);
});

bot.launch();
console.log('Bot running with real balance...');
setInterval(() => {}, 10000);
