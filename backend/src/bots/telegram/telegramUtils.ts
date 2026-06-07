import * as https from 'https';
import { env } from '../../config/env';

// FIX: Force IPv4 for WSL — node-fetch hangs on IPv6
const agent = new https.Agent({ family: 4 });
const token = env.TELEGRAM_BOT_TOKEN;

/**
 * Send a Telegram message via native https (bypasses node-fetch hang).
 * This is used by portfolio commands that need reliable message delivery.
 */
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
