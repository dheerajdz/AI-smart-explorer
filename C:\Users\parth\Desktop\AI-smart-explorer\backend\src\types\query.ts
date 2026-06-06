// ============================================================
// query.ts
// Central type definitions for all supported bot actions.
// Any new capability must be registered here first.
// ============================================================

/**
 * Every action the Smart AI Explorer bot supports.
 * Used for:
 *   - Type-safe routing in WhatsApp/Telegram handlers
 *   - Validating Kimi parser output (reject hallucinations)
 *   - Generating help text dynamically
 */
export enum QueryAction {
  // ── Wallet & Balance ─────────────────────────────────────
  WALLET_BALANCE = 'wallet_balance',
  WALLET_ACTIVITY = 'wallet_activity',
  TOKEN_BALANCE = 'token_balance',
  NFT_BALANCE = 'nft_balance',

  // ── Transactions ─────────────────────────────────────────
  TRANSACTION_DETAIL = 'transaction_detail',
  FAILED_TRANSACTIONS = 'failed_transactions',
  LARGE_TRANSFERS = 'large_transfers',

  // ── Contracts ────────────────────────────────────────────
  CONTRACT_DEPLOYER = 'contract_deployer',
  CONTRACT_VERIFICATION = 'contract_verification',
  FAILED_CONTRACT_DEPLOYMENTS = 'failed_contract_deployments',

  // ── Network & Gas ────────────────────────────────────────
  GAS_PRICE = 'gas_price',
  BLOCK_INFO = 'block_info',
  NETWORK_STATS = 'network_stats',

  // ── Alerts & Monitoring ──────────────────────────────────
  CREATE_ALERT = 'create_alert',
  LIST_ALERTS = 'list_alerts',
  DELETE_ALERT = 'delete_alert',

  // ── Utility ──────────────────────────────────────────────
  HELP = 'help',
  UNKNOWN = 'unknown',
}

/**
 * Runtime array of all valid actions — used for validation.
 * Derived from the enum so it never goes out of sync.
 */
export const VALID_QUERY_ACTIONS: readonly QueryAction[] = Object.values(QueryAction);

/**
 * Structured result returned by queryParser.ts after parsing
 * a natural-language user message.
 */
export interface ParsedQuery {
  /** The routing key — determines which handler executes. */
  action: QueryAction;

  /** Any extra parameters extracted from the user message. */
  [key: string]: any;
}

/**
 * Human-readable descriptions for each action.
 * Used to generate dynamic help text and command suggestions.
 */
export const QUERY_ACTION_DESCRIPTIONS: Record<QueryAction, string> = {
  [QueryAction.WALLET_BALANCE]: 'Check XDC balance of a wallet address',
  [QueryAction.WALLET_ACTIVITY]: 'Show recent activity for a wallet',
  [QueryAction.TOKEN_BALANCE]: 'Check ERC-20 token balance',
  [QueryAction.NFT_BALANCE]: 'List NFT holdings for a wallet',

  [QueryAction.TRANSACTION_DETAIL]: 'Get details of a specific transaction',
  [QueryAction.FAILED_TRANSACTIONS]: 'Find failed transactions for an address',
  [QueryAction.LARGE_TRANSFERS]: 'Detect large token transfers',

  [QueryAction.CONTRACT_DEPLOYER]: 'Find who deployed a contract',
  [QueryAction.CONTRACT_VERIFICATION]: 'Check if a contract is verified',
  [QueryAction.FAILED_CONTRACT_DEPLOYMENTS]: 'Find failed contract deployments',

  [QueryAction.GAS_PRICE]: 'Get current or historical gas price',
  [QueryAction.BLOCK_INFO]: 'Get block details by number or hash',
  [QueryAction.NETWORK_STATS]: 'Show XDC network statistics',

  [QueryAction.CREATE_ALERT]: 'Create a new price or activity alert',
  [QueryAction.LIST_ALERTS]: 'Show your active alerts',
  [QueryAction.DELETE_ALERT]: 'Remove an existing alert',

  [QueryAction.HELP]: 'Show available commands and examples',
  [QueryAction.UNKNOWN]: 'Unrecognized query — try rephrasing',
};

/**
 * Example prompts for each action.
 * Shown to users when they type "help" or send an unknown query.
 */
export const QUERY_ACTION_EXAMPLES: Record<QueryAction, string[]> = {
  [QueryAction.WALLET_BALANCE]: [
    'Balance of xdc123...',
    'How much XDC does 0xabc... have?',
  ],
  [QueryAction.WALLET_ACTIVITY]: [
    'Show activity for xdc123...',
    'What has 0xabc... been doing?',
  ],
  [QueryAction.TOKEN_BALANCE]: [
    'Token balance of xdc123...',
    'How many USDT does 0xabc... hold?',
  ],
  [QueryAction.NFT_BALANCE]: [
    'NFTs owned by xdc123...',
    'Show NFT collection for 0xabc...',
  ],

  [QueryAction.TRANSACTION_DETAIL]: [
    'Tx 0xabc...',
    'Show transaction 0x123...',
  ],
  [QueryAction.FAILED_TRANSACTIONS]: [
    'Failed transactions for xdc123...',
    'Show failed txs last week',
  ],
  [QueryAction.LARGE_TRANSFERS]: [
    'Large transfers from xdc123...',
    'Whale movements today',
  ],

  [QueryAction.CONTRACT_DEPLOYER]: [
    'Who deployed 0xabc...?',
    'Contract deployer of 0x123...',
  ],
  [QueryAction.CONTRACT_VERIFICATION]: [
    'Is 0xabc... verified?',
    'Check contract verification',
  ],
  [QueryAction.FAILED_CONTRACT_DEPLOYMENTS]: [
    'Failed contract deploys last week',
    'Show failed deployments',
  ],

  [QueryAction.GAS_PRICE]: [
    'Gas price now',
    'What was gas yesterday?',
  ],
  [QueryAction.BLOCK_INFO]: [
    'Block 12345',
    'Latest block info',
  ],
  [QueryAction.NETWORK_STATS]: [
    'Network stats',
    'XDC network overview',
  ],

  [QueryAction.CREATE_ALERT]: [
    'Alert me when XDC drops below $0.02',
    'Notify if gas > 50 gwei',
  ],
  [QueryAction.LIST_ALERTS]: [
    'Show my alerts',
    'List active alerts',
  ],
  [QueryAction.DELETE_ALERT]: [
    'Delete alert #1',
    'Remove my gas alert',
  ],

  [QueryAction.HELP]: [
    'help',
    '?',
  ],
  [QueryAction.UNKNOWN]: [
    'Try one of the examples above',
  ],
};
