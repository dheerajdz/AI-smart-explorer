import { redis } from '../../database/redis';
import { logger } from '../../utils/logger';

export type ConversationStep =
  | 'idle'
  | 'awaiting_signup_email'
  | 'awaiting_signup_otp'
  | 'awaiting_signup_wallet'
  | 'awaiting_signin_otp';

export interface ConversationState {
  step: ConversationStep;
  telegramId: number;
  telegramUsername?: string;
  action?: 'signup' | 'signin';
  email?: string;
}

const CONVERSATION_TTL_SECONDS = 600; // 10 minutes

function getKey(telegramId: number): string {
  return `conv:${telegramId}`;
}

export class ConversationStateService {
  /**
   * Set conversation state for a user
   */
  static async setState(state: ConversationState): Promise<void> {
    try {
      const key = getKey(state.telegramId);
      await redis.setex(key, CONVERSATION_TTL_SECONDS, JSON.stringify(state));
    } catch (err) {
      logger.error('Failed to set conversation state', err);
    }
  }

  /**
   * Get conversation state for a user
   */
  static async getState(telegramId: number): Promise<ConversationState | null> {
    try {
      const key = getKey(telegramId);
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as ConversationState;
    } catch (err) {
      logger.error('Failed to get conversation state', err);
      return null;
    }
  }

  /**
   * Clear conversation state for a user
   */
  static async clearState(telegramId: number): Promise<void> {
    try {
      const key = getKey(telegramId);
      await redis.del(key);
    } catch (err) {
      logger.error('Failed to clear conversation state', err);
    }
  }

  /**
   * Check if user is in a specific step
   */
  static async isStep(telegramId: number, step: ConversationStep): Promise<boolean> {
    const state = await this.getState(telegramId);
    return state?.step === step;
  }
}
