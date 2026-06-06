export type Platform = 'telegram' | 'whatsapp' | 'slack' | 'x';

export interface BotContext {
  platform: Platform;
  userId: string;
  text: string;
}

export interface BotResponse {
  text: string;
  parseMode?: 'markdown' | 'html' | 'plain';
}
