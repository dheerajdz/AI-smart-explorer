/**
 * Language Detection Service
 * Detects language from user input text
 */

export type SupportedLanguage = 'en' | 'hi' | 'mr';

interface DetectionResult {
  language: SupportedLanguage;
  confidence: number;
  method: 'explicit' | 'devanagari' | 'hinglish' | 'marathi' | 'default';
}

// Devanagari Unicode range (Hindi, Marathi, Sanskrit, etc.)
const DEVANAGARI_RANGE = /[\u0900-\u097F]/;

// Hinglish (Romanized Hindi) common words
const HINGLISH_PATTERNS = [
  /\b(batao|bata|dikhao|dikha|kitna|kaisa|kya|kaise|kar|karo|hai|hain|ho|hoga|karunga|karungi|dekhna|jana|jao|aao|aana)\b/i,
];

// Marathi-specific words (in Roman script)
const MARATHI_PATTERNS = [
  /\b(dakhva|dakha|kiti|kasa|kay|kas|kar|kara|ahe|ahot|honar|karin|pahije|jau|ja|ya|ya)\b/i,
];

// Marathi-specific Devanagari characters/words
const MARATHI_DEVANAGARI = /[ळऱ]/;

/**
 * Detect language from input text
 */
export function detectLanguage(text: string): DetectionResult {
  // Check for Devanagari script
  if (DEVANAGARI_RANGE.test(text)) {
    // Distinguish Marathi from Hindi in Devanagari
    if (MARATHI_DEVANAGARI.test(text)) {
      return { language: 'mr', confidence: 0.9, method: 'devanagari' };
    }
    // Default to Hindi for Devanagari (most common)
    return { language: 'hi', confidence: 0.85, method: 'devanagari' };
  }

  // Check for Marathi Roman patterns
  for (const pattern of MARATHI_PATTERNS) {
    if (pattern.test(text)) {
      return { language: 'mr', confidence: 0.8, method: 'marathi' };
    }
  }

  // Check for Hinglish patterns
  for (const pattern of HINGLISH_PATTERNS) {
    if (pattern.test(text)) {
      return { language: 'hi', confidence: 0.75, method: 'hinglish' };
    }
  }

  // Default to English
  return { language: 'en', confidence: 1.0, method: 'default' };
}

/**
 * Check if text contains mixed language (Hinglish)
 */
export function isMixedLanguage(text: string): boolean {
  const hasEnglish = /[a-zA-Z]/.test(text);
  const hasDevanagari = DEVANAGARI_RANGE.test(text);
  return hasEnglish && hasDevanagari;
}
