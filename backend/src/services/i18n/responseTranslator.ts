import { SupportedLanguage } from './index';
import { getTranslation, TranslationKey } from './translations';

// ─── Dynamic Response Patterns ──────────────────────────────

/**
 * Common English phrases in blockchain responses and their translations.
 * Used for dynamic content not covered by TranslationKey.
 */
const RESPONSE_PATTERNS: Record<string, Record<SupportedLanguage, string>> = {
  'Balance': {
    en: 'Balance',
    hi: 'बैलेंस',
    mr: 'शिल्लक',
  },
  'Wallet': {
    en: 'Wallet',
    hi: 'वॉलेट',
    mr: 'वॉलेट',
  },
  'Transaction': {
    en: 'Transaction',
    hi: 'लेनदेन',
    mr: 'व्यवहार',
  },
  'Address': {
    en: 'Address',
    hi: 'पता',
    mr: 'पत्ता',
  },
  'Amount': {
    en: 'Amount',
    hi: 'राशि',
    mr: 'रक्कम',
  },
  'Value': {
    en: 'Value',
    hi: 'मूल्य',
    mr: 'किंमत',
  },
  'Gas': {
    en: 'Gas',
    hi: 'गैस',
    mr: 'गॅस',
  },
  'Block': {
    en: 'Block',
    hi: 'ब्लॉक',
    mr: 'ब्लॉक',
  },
  'Network': {
    en: 'Network',
    hi: 'नेटवर्क',
    mr: 'नेटवर्क',
  },
  'Alert': {
    en: 'Alert',
    hi: 'अलर्ट',
    mr: 'अलर्ट',
  },
  'Webhook': {
    en: 'Webhook',
    hi: 'वेबहुक',
    mr: 'वेबहुक',
  },
  'Success': {
    en: 'Success',
    hi: 'सफल',
    mr: 'यशस्वी',
  },
  'Failed': {
    en: 'Failed',
    hi: 'विफल',
    mr: 'अयशस्वी',
  },
  'Pending': {
    en: 'Pending',
    hi: 'लंबित',
    mr: 'प्रलंबित',
  },
  'Confirmed': {
    en: 'Confirmed',
    hi: 'पुष्टि हुई',
    mr: 'पुष्टी झाली',
  },
  'From': {
    en: 'From',
    hi: 'से',
    mr: 'पासून',
  },
  'To': {
    en: 'To',
    hi: 'को',
    mr: 'ला',
  },
  'Hash': {
    en: 'Hash',
    hi: 'हैश',
    mr: 'हॅश',
  },
  'Date': {
    en: 'Date',
    hi: 'तारीख',
    mr: 'तारीख',
  },
  'Status': {
    en: 'Status',
    hi: 'स्थिति',
    mr: 'स्थिती',
  },
  'Total': {
    en: 'Total',
    hi: 'कुल',
    mr: 'एकूण',
  },
  'Current': {
    en: 'Current',
    hi: 'वर्तमान',
    mr: 'सध्याचे',
  },
  'Previous': {
    en: 'Previous',
    hi: 'पिछला',
    mr: 'मागील',
  },
  'Change': {
    en: 'Change',
    hi: 'बदलाव',
    mr: 'बदल',
  },
  'of': {
    en: 'of',
    hi: 'का',
    mr: 'चे',
  },
  'for': {
    en: 'for',
    hi: 'के लिए',
    mr: 'साठी',
  },
};

// ─── Public API ─────────────────────────────────────────────

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
 * Auto-translate any English response text to target language.
 * Uses pattern matching for common blockchain terms.
 *
 * Flow:
 *   English Response → Find Patterns → Replace with Translation → Return
 *
 * @param text English response from blockchain service
 * @param lang Target language (en/hi/mr)
 * @returns Translated text or original if English
 */
export function translateDynamicText(
  text: string,
  lang: SupportedLanguage
): string {
  // If English, return as-is
  if (lang === 'en') return text;

  let translated = text;

  // Replace known patterns (longest first to avoid partial matches)
  const sortedPatterns = Object.keys(RESPONSE_PATTERNS).sort((a, b) => b.length - a.length);

  for (const pattern of sortedPatterns) {
    const translation = RESPONSE_PATTERNS[pattern][lang];
    // Use word boundary regex for whole word replacement
    const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
    translated = translated.replace(regex, translation);
  }

  return translated;
}

/**
 * Format and translate a complete bot response.
 * Combines template translation with dynamic text translation.
 *
 * @param templateKey Translation key for the response template
 * @param dynamicText Additional dynamic text to translate
 * @param lang Target language
 * @param variables Template variables
 */
export function formatAndTranslate(
  templateKey: TranslationKey,
  dynamicText: string,
  lang: SupportedLanguage,
  variables?: Record<string, string | number>
): string {
  // Get translated template
  const template = translateResponse(templateKey, lang, variables);

  // If not English, also translate dynamic text
  if (lang !== 'en') {
    const translatedDynamic = translateDynamicText(dynamicText, lang);
    return `${template}\n\n${translatedDynamic}`;
  }

  return `${template}\n\n${dynamicText}`;
}

/**
 * Quick translate wrapper for simple responses.
 * Detects if translation is needed and applies it.
 */
export function autoTranslate(
  text: string,
  lang: SupportedLanguage
): string {
  if (lang === 'en') return text;
  return translateDynamicText(text, lang);
}
