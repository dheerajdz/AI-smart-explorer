export interface TranslationKeys {
  // ── Welcome & General ──
  welcome_title: string;
  welcome_description: string;
  welcome_connected: string;
  welcome_not_connected: string;

  // ── Commands ──
  cmd_help_title: string;
  cmd_balance_title: string;
  cmd_tx_title: string;
  cmd_activity_title: string;
  cmd_gas_title: string;
  cmd_block_title: string;
  cmd_status_title: string;
  cmd_price_title: string;
  cmd_failed_title: string;
  cmd_large_title: string;
  cmd_track_title: string;
  cmd_untrack_title: string;
  cmd_list_title: string;
  cmd_alerts_title: string;
  cmd_reputation_title: string;
  cmd_leaderboard_title: string;
  cmd_chains_title: string;

  // ── Buttons ──
  btn_connect_wallet: string;
  btn_view_balance: string;
  btn_view_transactions: string;
  btn_track_wallet: string;
  btn_untrack_wallet: string;
  btn_set_alert: string;
  btn_upgrade_plan: string;
  btn_view_reputation: string;
  btn_leaderboard: string;
  btn_help: string;
  btn_back: string;

  // ── Messages ──
  msg_wallet_connected: string;
  msg_wallet_disconnected: string;
  msg_alert_created: string;
  msg_alert_triggered: string;
  msg_alert_deleted: string;
  msg_payment_success: string;
  msg_payment_failed: string;
  msg_upgrade_prompt: string;
  msg_limit_reached: string;

  // ── Errors ──
  err_invalid_address: string;
  err_invalid_command: string;
  err_server_error: string;
  err_not_found: string;
  err_unauthorized: string;
  err_limit_reached: string;
  err_no_wallet: string;

  // ── Prompts ──
  prompt_enter_address: string;
  prompt_select_network: string;
  prompt_select_language: string;

  // ── Status ──
  status_active: string;
  status_inactive: string;
  status_pending: string;
  status_completed: string;
}

const en: TranslationKeys = {
  welcome_title: '👋 Welcome to AI Smart Explorer',
  welcome_description: 'Your intelligent blockchain companion for XDC and beyond.',
  welcome_connected: '✅ Wallet connected',
  welcome_not_connected: '❌ No wallet connected',

  cmd_help_title: '📚 Help',
  cmd_balance_title: '💰 Balance',
  cmd_tx_title: '📄 Transactions',
  cmd_activity_title: '📊 Activity',
  cmd_gas_title: '⛽ Gas Price',
  cmd_block_title: '📦 Block Info',
  cmd_status_title: '🌐 Network Status',
  cmd_price_title: '📈 Price',
  cmd_failed_title: '❌ Failed TXs',
  cmd_large_title: '🐋 Large Transfers',
  cmd_track_title: '🔔 Track Wallet',
  cmd_untrack_title: '🔕 Untrack Wallet',
  cmd_list_title: '📋 Tracked Wallets',
  cmd_alerts_title: '🔔 Alerts',
  cmd_reputation_title: '💎 Reputation',
  cmd_leaderboard_title: '🏆 Leaderboard',
  cmd_chains_title: '🌐 Chains',

  btn_connect_wallet: '🔗 Connect Wallet',
  btn_view_balance: '💰 View Balance',
  btn_view_transactions: '📄 Transactions',
  btn_track_wallet: '🔔 Track',
  btn_untrack_wallet: '🔕 Untrack',
  btn_set_alert: '🔔 Set Alert',
  btn_upgrade_plan: '💎 Upgrade',
  btn_view_reputation: '💎 Reputation',
  btn_leaderboard: '🏆 Leaderboard',
  btn_help: '❓ Help',
  btn_back: '◀️ Back',

  msg_wallet_connected: '✅ Wallet connected successfully',
  msg_wallet_disconnected: '✅ Wallet disconnected',
  msg_alert_created: '✅ Alert created successfully',
  msg_alert_triggered: '🔔 Alert triggered',
  msg_alert_deleted: '✅ Alert deleted',
  msg_payment_success: '🎉 Payment successful',
  msg_payment_failed: '❌ Payment failed',
  msg_upgrade_prompt: '💎 Upgrade to unlock more features',
  msg_limit_reached: '⚠️ Limit reached',

  err_invalid_address: '❌ Invalid address',
  err_invalid_command: '❌ Unknown command',
  err_server_error: '❌ Server error',
  err_not_found: '❌ Not found',
  err_unauthorized: '❌ Unauthorized',
  err_limit_reached: '❌ Limit reached for your plan',
  err_no_wallet: '❌ No wallet connected',

  prompt_enter_address: 'Please enter a wallet address',
  prompt_select_network: 'Please select a network',
  prompt_select_language: 'Please select a language',

  status_active: '✅ Active',
  status_inactive: '⏸️ Inactive',
  status_pending: '⏳ Pending',
  status_completed: '✅ Completed',
};

const hi: TranslationKeys = {
  welcome_title: '👋 AI Smart Explorer में आपका स्वागत है',
  welcome_description: 'XDC और अन्य ब्लॉकचेन के लिए आपका बुद्धिमान साथी।',
  welcome_connected: '✅ वॉलेट कनेक्टेड',
  welcome_not_connected: '❌ कोई वॉलेट कनेक्ट नहीं',

  cmd_help_title: '📚 सहायता',
  cmd_balance_title: '💰 बैलेंस',
  cmd_tx_title: '📄 लेनदेन',
  cmd_activity_title: '📊 गतिविधि',
  cmd_gas_title: '⛽ गैस मूल्य',
  cmd_block_title: '📦 ब्लॉक जानकारी',
  cmd_status_title: '🌐 नेटवर्क स्थिति',
  cmd_price_title: '📈 मूल्य',
  cmd_failed_title: '❌ विफल लेनदेन',
  cmd_large_title: '🐋 बड़े ट्रांसफर',
  cmd_track_title: '🔔 वॉलेट ट्रैक करें',
  cmd_untrack_title: '🔕 ट्रैकिंग बंद करें',
  cmd_list_title: '📋 ट्रैक किए गए वॉलेट',
  cmd_alerts_title: '🔔 अलर्ट्स',
  cmd_reputation_title: '💎 प्रतिष्ठा',
  cmd_leaderboard_title: '🏆 लीडरबोर्ड',
  cmd_chains_title: '🌐 चेन सूची',

  btn_connect_wallet: '🔗 वॉलेट कनेक्ट करें',
  btn_view_balance: '💰 बैलेंस देखें',
  btn_view_transactions: '📄 लेनदेन देखें',
  btn_track_wallet: '🔔 ट्रैक करें',
  btn_untrack_wallet: '🔕 अनट्रैक करें',
  btn_set_alert: '🔔 अलर्ट सेट करें',
  btn_upgrade_plan: '💎 अपग्रेड करें',
  btn_view_reputation: '💎 प्रतिष्ठा देखें',
  btn_leaderboard: '🏆 लीडरबोर्ड',
  btn_help: '❓ सहायता',
  btn_back: '◀️ वापस',

  msg_wallet_connected: '✅ वॉलेट सफलतापूर्वक कनेक्ट हो गया',
  msg_wallet_disconnected: '✅ वॉलेट डिस्कनेक्ट हो गया',
  msg_alert_created: '✅ अलर्ट सफलतापूर्वक बनाया गया',
  msg_alert_triggered: '🔔 अलर्ट ट्रिगर हुआ',
  msg_alert_deleted: '✅ अलर्ट हटा दिया गया',
  msg_payment_success: '🎉 भुगतान सफल',
  msg_payment_failed: '❌ भुगतान विफल',
  msg_upgrade_prompt: '💎 और सुविधाएं अनलॉक करने के लिए अपग्रेड करें',
  msg_limit_reached: '⚠️ सीमा पहुंच गई',

  err_invalid_address: '❌ अमान्य पता',
  err_invalid_command: '❌ अज्ञात कमांड',
  err_server_error: '❌ सर्वर त्रुटि',
  err_not_found: '❌ नहीं मिला',
  err_unauthorized: '❌ अनधिकृत',
  err_limit_reached: '❌ आपकी योजना की सीमा पहुंच गई',
  err_no_wallet: '❌ कोई वॉलेट कनेक्ट नहीं',

  prompt_enter_address: 'कृपया एक वॉलेट पता दर्ज करें',
  prompt_select_network: 'कृपया एक नेटवर्क चुनें',
  prompt_select_language: 'कृपया एक भाषा चुनें',

  status_active: '✅ सक्रिय',
  status_inactive: '⏸️ निष्क्रिय',
  status_pending: '⏳ लंबित',
  status_completed: '✅ पूर्ण',
};

const mr: TranslationKeys = {
  welcome_title: '👋 AI Smart Explorer मध्ये आपले स्वागत आहे',
  welcome_description: 'XDC आणि इतर ब्लॉकचेनसाठी तुमचा बुद्धिमान साथीदार.',
  welcome_connected: '✅ वॉलेट कनेक्टेड',
  welcome_not_connected: '❌ कोणतेही वॉलेट कनेक्ट नाही',

  cmd_help_title: '📚 मदत',
  cmd_balance_title: '💰 बॅलन्स',
  cmd_tx_title: '📄 व्यवहार',
  cmd_activity_title: '📊 क्रियाकलाप',
  cmd_gas_title: '⛽ गॅस किंमत',
  cmd_block_title: '📦 ब्लॉक माहिती',
  cmd_status_title: '🌐 नेटवर्क स्थिती',
  cmd_price_title: '📈 किंमत',
  cmd_failed_title: '❌ अयशस्वी व्यवहार',
  cmd_large_title: '🐋 मोठे हस्तांतरण',
  cmd_track_title: '🔔 वॉलेट ट्रॅक करा',
  cmd_untrack_title: '🔕 ट्रॅकिंग बंद करा',
  cmd_list_title: '📋 ट्रॅक केलेले वॉलेट',
  cmd_alerts_title: '🔔 अलर्ट्स',
  cmd_reputation_title: '💎 प्रतिष्ठा',
  cmd_leaderboard_title: '🏆 लीडरबोर्ड',
  cmd_chains_title: '🌐 चेन यादी',

  btn_connect_wallet: '🔗 वॉलेट कनेक्ट करा',
  btn_view_balance: '💰 बॅलन्स पहा',
  btn_view_transactions: '📄 व्यवहार पहा',
  btn_track_wallet: '🔔 ट्रॅक करा',
  btn_untrack_wallet: '🔕 अनट्रॅक करा',
  btn_set_alert: '🔔 अलर्ट सेट करा',
  btn_upgrade_plan: '💎 अपग्रेड करा',
  btn_view_reputation: '💎 प्रतिष्ठा पहा',
  btn_leaderboard: '🏆 लीडरबोर्ड',
  btn_help: '❓ मदत',
  btn_back: '◀️ मागे',

  msg_wallet_connected: '✅ वॉलेट यशस्वीरित्या कनेक्ट झाले',
  msg_wallet_disconnected: '✅ वॉलेट डिस्कनेक्ट झाले',
  msg_alert_created: '✅ अलर्ट यशस्वीरित्या तयार झाले',
  msg_alert_triggered: '🔔 अलर्ट ट्रिगर झाले',
  msg_alert_deleted: '✅ अलर्ट हटवले',
  msg_payment_success: '🎉 पेमेंट यशस्वी',
  msg_payment_failed: '❌ पेमेंट अयशस्वी',
  msg_upgrade_prompt: '💎 अधिक सुविधा अनलॉक करण्यासाठी अपग्रेड करा',
  msg_limit_reached: '⚠️ मर्यादा पोहोचली',

  err_invalid_address: '❌ अवैध पत्ता',
  err_invalid_command: '❌ अज्ञात कमांड',
  err_server_error: '❌ सर्व्हर त्रुटी',
  err_not_found: '❌ सापडले नाही',
  err_unauthorized: '❌ अनधिकृत',
  err_limit_reached: '❌ तुमच्या योजनेची मर्यादा पोहोचली',
  err_no_wallet: '❌ कोणतेही वॉलेट कनेक्ट नाही',

  prompt_enter_address: 'कृपया एक वॉलेट पत्ता प्रविष्ट करा',
  prompt_select_network: 'कृपया एक नेटवर्क निवडा',
  prompt_select_language: 'कृपया एक भाषा निवडा',

  status_active: '✅ सक्रिय',
  status_inactive: '⏸️ निष्क्रिय',
  status_pending: '⏳ प्रलंबित',
  status_completed: '✅ पूर्ण',
};

export const translations: Record<string, TranslationKeys> = { en, hi, mr };

export function getTranslation(lang: string): TranslationKeys {
  return translations[lang] || translations['en'];
}

export function getSupportedLanguages(): { code: string; name: string; flag: string }[] {
  return [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'mr', name: 'मराठी', flag: '🇮🇳' },
  ];
}
