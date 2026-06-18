import { ConnectedWalletModel } from '../models/ConnectedWallet';
import { getTranslation, TranslationKeys } from '../i18n';
import { logger } from '../utils/logger';

/**
 * Get user's preferred language from their connected wallet
 */
export async function getUserLanguage(
  userId: string,
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x'
): Promise<string> {
  try {
    const wallet = await ConnectedWalletModel.findByUserId(userId, platform);
    return wallet?.language || 'en';
  } catch (err) {
    logger.error('[i18nService] Failed to get user language', { userId, error: err });
    return 'en';
  }
}

/**
 * Set user's preferred language
 */
export async function setUserLanguage(
  userId: string,
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x',
  language: string
): Promise<boolean> {
  try {
    const result = await ConnectedWalletModel.updateOne(
      { userId, platform },
      { language: language as any }
    );
    return result;
  } catch (err) {
    logger.error('[i18nService] Failed to set user language', { userId, language, error: err });
    return false;
  }
}

/**
 * Get translated strings for a user
 */
export async function getUserTranslation(
  userId: string,
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x'
): Promise<TranslationKeys> {
  const lang = await getUserLanguage(userId, platform);
  return getTranslation(lang);
}

/**
 * Get translated strings by language code
 */
export function getTranslationByLang(language: string): TranslationKeys {
  return getTranslation(language);
}
