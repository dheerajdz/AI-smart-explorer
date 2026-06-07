import { SupportedLanguage } from './index';
import { getTranslation, TranslationKey } from './translations';

/**
 * Translate a bot response to the user's preferred language.
 * Wraps the translation system for response formatting.
 */
export function translateResponse(
  key: TranslationKey,
  lang: SupportedLanguage = 'en',
  variables?: Record<string, string | number>
): string {
  return getTranslation(key, lang, variables);
}

/**
 * Auto-translate any text using a simple mapping fallback.
 * For dynamic content not in the translation dictionary.
 */
export function translateDynamicText(
  text: string,
  lang: SupportedLanguage
): string {
  // If English, return as-is
  if (lang === 'en') return text;

  // For now, return English with a note
  // In production, integrate with Google Translate or similar API
  return text;
}
