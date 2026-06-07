// ============================================================
// i18n — Internationalization module
// Language support: English, Hindi, Marathi
// ============================================================

export type SupportedLanguage = 'en' | 'hi' | 'mr';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'hi', 'mr'];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  hi: 'हिंदी',
  mr: 'मराठी',
};

export { detectLanguage } from './languageDetector';
export { translateResponse } from './responseTranslator';
export { getTranslation } from './translations';
