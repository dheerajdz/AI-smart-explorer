/**
 * i18n Service - Main entry point for internationalization
 */
import { SupportedLanguage, detectLanguage } from './languageDetector';
import { translateResponse } from './responseTranslator';

export { SupportedLanguage, detectLanguage };
export { translateResponse };

/**
 * Get language name for display
 */
export function getLanguageName(language: SupportedLanguage): string {
  const names: Record<SupportedLanguage, string> = {
    en: 'English',
    hi: 'Hindi',
    mr: 'Marathi',
  };
  return names[language];
}

/**
 * Validate language code
 */
export function isValidLanguage(lang: string): lang is SupportedLanguage {
  return ['en', 'hi', 'mr'].includes(lang);
}
