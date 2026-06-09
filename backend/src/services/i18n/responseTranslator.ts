/**
 * Response Translation Service
 * Translates bot responses to user's preferred language using Kimi AI
 */
import { SupportedLanguage } from './languageDetector';
import { askKimi } from '../ai/kimiService';
import { logger } from '../../utils/logger';

// Cache for common translations to reduce LLM calls
const translationCache = new Map<string, string>();
const CACHE_MAX_SIZE = 100;

/**
 * Translate a response to the user's language
 */
export async function translateResponse(
  text: string,
  targetLanguage: SupportedLanguage
): Promise<string> {
  if (targetLanguage === 'en') return text;

  // Check cache
  const cacheKey = `${targetLanguage}:${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  try {
    const translated = await askKimi(
      `Translate this blockchain response to ${getLanguageName(targetLanguage)}. ` +
      `Keep all formatting, emojis, wallet addresses, transaction hashes, and numbers unchanged. ` +
      `Only translate the natural language text:\n\n${text}`
    );

    // Cache result
    if (translationCache.size >= CACHE_MAX_SIZE) {
      const firstKey = translationCache.keys().next().value;
      if (firstKey) {
        translationCache.delete(firstKey);
      }
    }
    translationCache.set(cacheKey, translated);

    return translated;
  } catch (err) {
    logger.error('Translation failed, returning original', { error: err, targetLanguage });
    return text;
  }
}

function getLanguageName(lang: SupportedLanguage): string {
  const names: Record<SupportedLanguage, string> = {
    en: 'English',
    hi: 'Hindi',
    mr: 'Marathi',
  };
  return names[lang];
}
