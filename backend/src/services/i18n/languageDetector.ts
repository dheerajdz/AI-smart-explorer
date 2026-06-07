import { SupportedLanguage, SUPPORTED_LANGUAGES } from './index';

// ─── Keyword Dictionaries ───────────────────────────────────

const HINGLISH_KEYWORDS = [
  // Common Hinglish words used in crypto/blockchain context
  'batao', 'bata', 'dikhao', 'dekho', 'karo', 'kya', 'kaise', 'kitna',
  'mera', 'apna', 'yeh', 'woh', 'hai', 'hain', 'nahi', 'karke',
  'balance', 'wallet', 'transaction', 'bhejo', 'check', 'dalo',
  'track', 'alert', 'price', 'gas', 'block', 'network',
  'batao', 'dikhao', 'bhejo', 'bataiye', 'dikhaye', 'bhejiye',
  'kitne', 'kitna', 'sab', 'pura', 'poora', 'abhi', 'pehle',
  'last', 'recent', 'naya', 'nayi', 'sabse', 'zyada', 'kam',
];

const MARATHI_KEYWORDS = [
  // Common Marathi words used in crypto/blockchain context
  'maza', 'mazi', 'maze', 'tumcha', 'tumchi', 'tumche',
  'dakhava', 'dakha', 'paha', 'kara', 'kay', 'kase', 'kiti',
  'balance', 'wallet', 'transaction', 'pathava', 'check', 'taka',
  'track', 'alert', 'kimat', 'gas', 'block', 'network',
  'dakhava', 'pathava', 'dakhvaa', 'pathvaa', 'dakhav',
  'sagla', 'sagle', 'purna', 'ata', 'adhi', 'magil',
  'nava', 'navi', 'sarvat', 'jyasta', 'kami',
  // Marathi-specific verb endings
  'aahe', 'ahet', 'nahi', 'karun', 'dilya', 'ale', 'gel',
  'hot', 'hote', 'honar', 'zala', 'zali', 'zale',
];

const MARATHI_SPECIFIC_CHARS = /[ळऴ]/;
const DEVANAGARI_PATTERN = /[\u0900-\u097F]/;

// ─── Public API ─────────────────────────────────────────────

/**
 * Detect language from user input text with full priority order:
 * 1. Explicit /lang command
 * 2. Devanagari script (Marathi-specific chars → mr, else hi)
 * 3. Hinglish keywords → hi
 * 4. Marathi keywords → mr
 * 5. English fallback
 */
export function detectLanguage(text: string): SupportedLanguage {
  const lower = text.toLowerCase().trim();

  // ── 1. Explicit language commands ─────────────────────────
  if (lower.startsWith('/lang ')) {
    const parts = text.split(/\s+/);
    const langCode = parts[1]?.toLowerCase() as SupportedLanguage;
    if (SUPPORTED_LANGUAGES.includes(langCode)) {
      return langCode;
    }
  }

  // ── 2. Devanagari script detection ────────────────────────
  if (DEVANAGARI_PATTERN.test(text)) {
    // Marathi-specific characters: ळ, ऴ
    if (MARATHI_SPECIFIC_CHARS.test(text)) {
      return 'mr';
    }

    // Additional Marathi patterns (words ending in 'े', 'ी' more common in Marathi)
    const marathiPatterns = /[ेी]\s/;
    if (marathiPatterns.test(text)) {
      return 'mr';
    }

    // Default Devanagari to Hindi (safer fallback)
    return 'hi';
  }

  // ── 3. Hinglish keyword detection ─────────────────────────
  const hinglishScore = scoreKeywords(lower, HINGLISH_KEYWORDS);
  if (hinglishScore >= 2) {
    return 'hi';
  }

  // ── 4. Marathi keyword detection ──────────────────────────
  const marathiScore = scoreKeywords(lower, MARATHI_KEYWORDS);
  if (marathiScore >= 2) {
    return 'mr';
  }

  // ── 5. English fallback ───────────────────────────────────
  return 'en';
}

/**
 * Detect language with user preference as priority.
 * This is the main function to use in message handlers.
 */
export function detectLanguageWithPreference(
  text: string,
  userPreferredLanguage?: SupportedLanguage
): SupportedLanguage {
  // Priority 1: User preference (if set and valid)
  if (userPreferredLanguage && SUPPORTED_LANGUAGES.includes(userPreferredLanguage)) {
    // Still check for explicit /lang override
    const lower = text.toLowerCase().trim();
    if (lower.startsWith('/lang ')) {
      const parts = text.split(/\s+/);
      const langCode = parts[1]?.toLowerCase() as SupportedLanguage;
      if (SUPPORTED_LANGUAGES.includes(langCode)) {
        return langCode;
      }
    }
    return userPreferredLanguage;
  }

  // Priority 2-5: Auto-detect from text
  return detectLanguage(text);
}

/**
 * Extract language preference from user message.
 * Returns detected language and cleaned message (without /lang command).
 */
export function extractLanguageAndMessage(text: string): {
  language: SupportedLanguage;
  message: string;
} {
  const lower = text.toLowerCase().trim();

  if (lower.startsWith('/lang ')) {
    const parts = text.split(/\s+/);
    const langCode = parts[1]?.toLowerCase() as SupportedLanguage;

    if (SUPPORTED_LANGUAGES.includes(langCode)) {
      const message = parts.slice(2).join(' ') || '';
      return { language: langCode, message };
    }
  }

  return { language: detectLanguage(text), message: text };
}

/**
 * Check if text contains mixed language (Hinglish/Minglish).
 */
export function isMixedLanguage(text: string): boolean {
  const lower = text.toLowerCase().trim();

  // Has English words
  const hasEnglish = /[a-z]{3,}/.test(lower);

  // Has Hinglish/Marathi keywords
  const hasHinglish = HINGLISH_KEYWORDS.some((kw) => lower.includes(kw));
  const hasMarathi = MARATHI_KEYWORDS.some((kw) => lower.includes(kw));

  return hasEnglish && (hasHinglish || hasMarathi);
}

// ─── Helpers ────────────────────────────────────────────────

function scoreKeywords(text: string, keywords: string[]): number {
  let score = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score++;
    }
  }
  return score;
}
