import { SupportedLanguage } from './index';

// ─── Translation Dictionary ─────────────────────────────────

export type TranslationKey =
  // Common
  | 'welcome'
  | 'help'
  | 'unknown_command'
  | 'error_generic'
  | 'loading'
  | 'success'
  | 'cancelled'

  // Wallet
  | 'wallet_balance'
  | 'wallet_activity'
  | 'wallet_not_found'
  | 'invalid_address'
  | 'track_success'
  | 'untrack_success'
  | 'track_list_empty'

  // Transactions
  | 'tx_detail'
  | 'tx_not_found'
  | 'tx_failed'
  | 'large_transfers'
  | 'new_tx_incoming'
  | 'new_tx_outgoing'

  // Alerts
  | 'alert_created'
  | 'alert_deleted'
  | 'alert_list_empty'
  | 'alert_triggered'

  // Webhooks
  | 'webhook_created'
  | 'webhook_deleted'
  | 'webhook_list_empty'
  | 'webhook_test_sent'

  // Network
  | 'gas_price'
  | 'block_info'
  | 'network_stats';

const TRANSLATIONS: Record<TranslationKey, Record<SupportedLanguage, string>> = {
  // ── Common ────────────────────────────────────────────────
  welcome: {
    en: '🤖 Welcome to Smart AI Explorer!\n\nI can help you with XDC blockchain queries.\nType "help" for available commands.',
    hi: '🤖 Smart AI Explorer में आपका स्वागत है!\n\nमैं XDC ब्लॉकचेन के सवालों में मदद कर सकता हूँ।\nकमांड्स देखने के लिए "help" टाइप करें।',
    mr: '🤖 Smart AI Explorer मध्ये आपले स्वागत आहे!\n\nमी XDC ब्लॉकचेनच्या प्रश्नांमध्ये मदत करू शकतो।\nकमांड्स पाहण्यासाठी "help" टाइप करा।',
  },

  help: {
    en: '🤖 *Smart AI Explorer Help*\n\n*Wallet Queries:*\n• "Balance of xdc123..."\n• "Show activity for 0xabc..."\n• "Large transfers from xdc123..."\n\n*Commands:*\n/help, /status, /track, /untrack, /list\n\n*Language:*\n/lang en - English\n/lang hi - हिंदी\n/lang mr - मराठी',
    hi: '🤖 *Smart AI Explorer सहायता*\n\n*वॉलेट प्रश्न:*\n• "Balance of xdc123..."\n• "Show activity for 0xabc..."\n• "Large transfers from xdc123..."\n\n*कमांड्स:*\n/help, /status, /track, /untrack, /list\n\n*भाषा:*\n/lang en - English\n/lang hi - हिंदी\n/lang mr - मराठी',
    mr: '🤖 *Smart AI Explorer मदत*\n\n*वॉलेट प्रश्न:*\n• "Balance of xdc123..."\n• "Show activity for 0xabc..."\n• "Large transfers from xdc123..."\n\n*कमांड्स:*\n/help, /status, /track, /untrack, /list\n\n*भाषा:*\n/lang en - English\n/lang hi - हिंदी\n/lang mr - मराठी',
  },

  unknown_command: {
    en: '🤔 I did not understand that.\n\nTry "help" to see what I can do.',
    hi: '🤔 मुझे समझ नहीं आया।\n\nमेरी क्षमताएँ देखने के लिए "help" टाइप करें।',
    mr: '🤔 मला समजले नाही।\n\nमाझी क्षमता पाहण्यासाठी "help" टाइप करा।',
  },

  error_generic: {
    en: '❌ Something went wrong. Please try again later.',
    hi: '❌ कुछ गड़बड़ हो गई। कृपया बाद में फिर से प्रयास करें।',
    mr: '❌ काहीतरी चूक झाले। कृपया नंतर पुन्हा प्रयत्न करा।',
  },

  loading: {
    en: '⏳ Fetching data...',
    hi: '⏳ डेटा लाया जा रहा है...',
    mr: '⏳ डेटा आणत आहे...',
  },

  success: {
    en: '✅ Done!',
    hi: '✅ हो गया!',
    mr: '✅ झाले!',
  },

  cancelled: {
    en: '❌ Cancelled.',
    hi: '❌ रद्द किया गया।',
    mr: '❌ रद्द केले।',
  },

  // ── Wallet ────────────────────────────────────────────────
  wallet_balance: {
    en: '💰 *Wallet Balance*\n\nAddress: `{address}`\nBalance: **{balance} XDC**',
    hi: '💰 *वॉलेट बैलेंस*\n\nपता: `{address}`\nबैलेंस: **{balance} XDC**',
    mr: '💰 *वॉलेट बॅलन्स*\n\nपत्ता: `{address}`\nबॅलन्स: **{balance} XDC**',
  },

  wallet_activity: {
    en: '📊 *Wallet Activity*\n\nAddress: `{address}`\nTotal Transactions: **{count}**',
    hi: '📊 *वॉलेट गतिविधि*\n\nपता: `{address}`\nकुल लेनदेन: **{count}**',
    mr: '📊 *वॉलेट क्रियाकलाप*\n\nपत्ता: `{address}`\nएकूण व्यवहार: **{count}**',
  },

  wallet_not_found: {
    en: '⚠️ Wallet not found.',
    hi: '⚠️ वॉलेट नहीं मिला।',
    mr: '⚠️ वॉलेट सापडले नाही।',
  },

  invalid_address: {
    en: '❌ Please provide a valid wallet address.\n\nExample: "Balance of xdc123..."',
    hi: '❌ कृपया एक वैध वॉलेट पता दें।\n\nउदाहरण: "Balance of xdc123..."',
    mr: '❌ कृपया एक वैध वॉलेट पत्ता द्या।\n\nउदाहरण: "Balance of xdc123..."',
  },

  track_success: {
    en: '✅ Wallet tracking enabled\n\nWallet:\n{wallet}',
    hi: '✅ वॉलेट ट्रैकिंग सक्षम\n\nवॉलेट:\n{wallet}',
    mr: '✅ वॉलेट ट्रॅकिंग सक्षम\n\nवॉलेट:\n{wallet}',
  },

  untrack_success: {
    en: '✅ Wallet removed from tracking\n\nWallet:\n{wallet}',
    hi: '✅ वॉलेट ट्रैकिंग से हटा दिया गया\n\nवॉलेट:\n{wallet}',
    mr: '✅ वॉलेट ट्रॅकिंगमधून काढले\n\nवॉलेट:\n{wallet}',
  },

  track_list_empty: {
    en: 'No tracked wallets.\n\nUse /track <wallet> to start tracking.',
    hi: 'कोई ट्रैक किया हुआ वॉलेट नहीं।\n\nट्रैकिंग शुरू करने के लिए /track <wallet> का उपयोग करें।',
    mr: 'ट्रॅक केलेले कोणतेही वॉलेट नाही।\n\nट्रॅकिंग सुरू करण्यासाठी /track <wallet> वापरा।',
  },

  // ── Transactions ──────────────────────────────────────────
  tx_detail: {
    en: '📋 *Transaction Detail*\n\nHash: `{hash}`\nFrom: `{from}`\nTo: `{to}`\nValue: **{value} XDC**',
    hi: '📋 *लेनदेन विवरण*\n\nहैश: `{hash}`\nसे: `{from}`\nको: `{to}`\nमूल्य: **{value} XDC**',
    mr: '📋 *व्यवहार तपशील*\n\nहॅश: `{hash}`\nपासून: `{from}`\nला: `{to}`\nकिंमत: **{value} XDC**',
  },

  tx_not_found: {
    en: '⚠️ Transaction not found.',
    hi: '⚠️ लेनदेन नहीं मिला।',
    mr: '⚠️ व्यवहार सापडला नाही।',
  },

  tx_failed: {
    en: '❌ Failed to fetch transaction. Please try again later.',
    hi: '❌ लेनदेन प्राप्त करने में विफल। कृपया बाद में फिर से प्रयास करें।',
    mr: '❌ व्यवहार मिळवण्यात अयशस्वी। कृपया नंतर पुन्हा प्रयत्न करा।',
  },

  large_transfers: {
    en: '🐋 *Large Transfers*\n\nAddress: `{address}`\nThreshold: **{threshold} XDC**\nFound: **{count}** transfers',
    hi: '🐋 *बड़े ट्रांसफर*\n\nपता: `{address}`\nसीमा: **{threshold} XDC**\nमिले: **{count}** ट्रांसफर',
    mr: '🐋 *मोठे ट्रान्सफर*\n\nपत्ता: `{address}`\nमर्यादा: **{threshold} XDC**\nसापडले: **{count}** ट्रान्सफर',
  },

  new_tx_incoming: {
    en: '📥 *Incoming Transaction*\n\nWallet: `{wallet}`\nAmount: **{value} XDC**\nFrom: `{from}`\nTx Hash: `{hash}`',
    hi: '📥 *आने वाला लेनदेन*\n\nवॉलेट: `{wallet}`\nराशि: **{value} XDC**\nसे: `{from}`\nटैक्स हैश: `{hash}`',
    mr: '📥 *येणारा व्यवहार*\n\nवॉलेट: `{wallet}`\nरक्कम: **{value} XDC**\nपासून: `{from}`\nटॅक्स हॅश: `{hash}`',
  },

  new_tx_outgoing: {
    en: '📤 *Outgoing Transaction*\n\nWallet: `{wallet}`\nAmount: **{value} XDC**\nTo: `{to}`\nTx Hash: `{hash}`',
    hi: '📤 *जाने वाला लेनदेन*\n\nवॉलेट: `{wallet}`\nराशि: **{value} XDC**\nको: `{to}`\nटैक्स हैश: `{hash}`',
    mr: '📤 *जाणारा व्यवहार*\n\nवॉलेट: `{wallet}`\nरक्कम: **{value} XDC**\nला: `{to}`\nटॅक्स हॅश: `{hash}`',
  },

  // ── Alerts ────────────────────────────────────────────────
  alert_created: {
    en: '🔔 *Alert Created*\n\nYour alert has been set. You will be notified when the condition is met.',
    hi: '🔔 *अलर्ट बनाया गया*\n\nआपका अलर्ट सेट कर दिया गया है। शर्त पूरी होने पर आपको सूचित किया जाएगा।',
    mr: '🔔 *अलर्ट तयार केले*\n\nतुमचा अलर्ट सेट केला आहे. शर्त पूर्ण झाल्यावर तुम्हाला सूचित केले जाईल.',
  },

  alert_deleted: {
    en: '🗑️ *Alert Deleted*\n\nThe alert has been removed.',
    hi: '🗑️ *अलर्ट हटा दिया गया*\n\nअलर्ट हटा दिया गया है।',
    mr: '🗑️ *अलर्ट काढले*\n\nअलर्ट काढले आहे.',
  },

  alert_list_empty: {
    en: '📋 *Your Alerts*\n\nYou have no active alerts.',
    hi: '📋 *आपके अलर्ट्स*\n\nआपके पास कोई सक्रिय अलर्ट नहीं है।',
    mr: '📋 *तुमचे अलर्ट्स*\n\nतुमच्याकडे कोणतेही सक्रिय अलर्ट नाही.',
  },

  alert_triggered: {
    en: '🚨 *Alert Triggered*\n\nType: {type}\nWallet: `{wallet}`\nCondition: {condition} {threshold} XDC\nCurrent Value: {value} XDC',
    hi: '🚨 *अलर्ट ट्रिगर हुआ*\n\nप्रकार: {type}\nवॉलेट: `{wallet}`\nशर्त: {condition} {threshold} XDC\nवर्तमान मूल्य: {value} XDC',
    mr: '🚨 *अलर्ट ट्रिगर झाले*\n\nप्रकार: {type}\nवॉलेट: `{wallet}`\nशर्त: {condition} {threshold} XDC\nसध्याचे मूल्य: {value} XDC',
  },

  // ── Webhooks ──────────────────────────────────────────────
  webhook_created: {
    en: '🔗 *Webhook Created*\n\nID: `{id}`\nURL: {url}\nEvents: {events}',
    hi: '🔗 *वेबहुक बनाया गया*\n\nआईडी: `{id}`\nयूआरएल: {url}\nइवेंट्स: {events}',
    mr: '🔗 *वेबहुक तयार केले*\n\nआयडी: `{id}`\nयूआरएल: {url}\nइवेंट्स: {events}',
  },

  webhook_deleted: {
    en: '🗑️ *Webhook Deleted*\n\nThe webhook has been removed.',
    hi: '🗑️ *वेबहुक हटा दिया गया*\n\nवेबहुक हटा दिया गया है।',
    mr: '🗑️ *वेबहुक काढले*\n\nवेबहुक काढले आहे.',
  },

  webhook_list_empty: {
    en: '📋 *Your Webhooks*\n\nYou have no active webhooks.',
    hi: '📋 *आपके वेबहुक्स*\n\nआपके पास कोई सक्रिय वेबहुक नहीं है।',
    mr: '📋 *तुमचे वेबहुक्स*\n\nतुमच्याकडे कोणतेही सक्रिय वेबहुक नाही.',
  },

  webhook_test_sent: {
    en: '✅ *Test Event Sent*\n\nCheck your endpoint for the payload.',
    hi: '✅ *टेस्ट इवेंट भेजा गया*\n\nपेलोड के लिए अपने एंडपॉइंट की जाँच करें।',
    mr: '✅ *टेस्ट इवेंट पाठवला*\n\nपेलोडसाठी तुमच्या एंडपॉइंटची तपासणी करा.',
  },

  // ── Network ───────────────────────────────────────────────
  gas_price: {
    en: '⛽ *Gas Price*\n\nCurrent gas price data is coming soon.',
    hi: '⛽ *गैस मूल्य*\n\nवर्तमान गैस मूल्य डेटा जल्द आ रहा है।',
    mr: '⛽ *गॅस किंमत*\n\nसध्याचा गॅस किंमत डेटा लवकरच येत आहे.',
  },

  block_info: {
    en: '📦 *Block Info*\n\nBlock lookup for `{block}` is coming soon.',
    hi: '📦 *ब्लॉक जानकारी*\n\n`{block}` के लिए ब्लॉक लुकअप जल्द आ रहा है।',
    mr: '📦 *ब्लॉक माहिती*\n\n`{block}` साठी ब्लॉक लुकअप लवकरच येत आहे.',
  },

  network_stats: {
    en: '📈 *Network Stats*\n\nXDC network overview is coming soon.',
    hi: '📈 *नेटवर्क आंकड़े*\n\nXDC नेटवर्क अवलोकन जल्द आ रहा है।',
    mr: '📈 *नेटवर्क आकडेवारी*\n\nXDC नेटवर्क आढावा लवकरच येत आहे.',
  },
};

/**
 * Get translated string by key and language.
 * Supports variable interpolation with {key} syntax.
 */
export function getTranslation(
  key: TranslationKey,
  lang: SupportedLanguage = 'en',
  variables?: Record<string, string | number>
): string {
  const translation = TRANSLATIONS[key]?.[lang] ?? TRANSLATIONS[key]?.['en'] ?? key;

  if (!variables) return translation;

  // Replace {variable} placeholders
  return Object.entries(variables).reduce((text, [varKey, varValue]) => {
    return text.replace(new RegExp(`{${varKey}}`, 'g'), String(varValue));
  }, translation);
}
