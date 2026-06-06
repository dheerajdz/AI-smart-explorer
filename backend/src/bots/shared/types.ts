export interface CommandContext {
  userId: string;        // telegramId or phoneNumber
  platform: 'telegram' | 'whatsapp';
}

export interface CommandResult {
  text: string;
  // Future: add buttons, images, etc.
}
