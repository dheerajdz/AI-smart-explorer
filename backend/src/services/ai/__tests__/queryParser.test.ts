// ============================================================
// queryParser.test.ts
// Unit tests for queryParser.ts — no Kimi API calls.
// Mocks askKimi to test parsing logic in isolation.
// ============================================================

import { QueryAction } from '../../types';
import { parseQuery, ParsedQuery } from '../queryParser';

// ─── Mock Kimi so we don't hit the real API ─────────────────
jest.mock('../kimiService', () => ({
  askKimi: jest.fn(),
}));

import { askKimi } from '../kimiService';

// ─── Helpers ────────────────────────────────────────────────

/**
 * Helper to mock a Kimi response for a single test.
 */
function mockKimiReturns(jsonString: string) {
  (askKimi as jest.Mock).mockResolvedValue(jsonString);
}

// ─── Tests ──────────────────────────────────────────────────

describe('queryParser', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Happy paths ──────────────────────────────────────────

  it('parses wallet balance query', async () => {
    mockKimiReturns('{"action":"wallet_balance","wallet":"xdc123"}');

    const result: ParsedQuery = await parseQuery('balance of xdc123');

    expect(result.action).toBe('wallet_balance');
    expect(result.wallet).toBe('xdc123');
  });

  it('parses failed contract deploys query', async () => {
    mockKimiReturns('{"action":"failed_contract_deployments","period":"7d"}');

    const result = await parseQuery('Show failed contract deploys last week');

    expect(result.action).toBe('failed_contract_deployments');
    expect(result.period).toBe('7d');
  });

  it('parses contract deployer query', async () => {
    mockKimiReturns('{"action":"contract_deployer","contract":"0x123"}');

    const result = await parseQuery('Who deployed this contract?');

    expect(result.action).toBe('contract_deployer');
    expect(result.contract).toBe('0x123');
  });

  it('parses transaction detail query', async () => {
    mockKimiReturns('{"action":"transaction_detail","txHash":"0xabc123"}');

    const result = await parseQuery('Tx 0xabc123');

    expect(result.action).toBe('transaction_detail');
    expect(result.txHash).toBe('0xabc123');
  });

  it('parses gas price query', async () => {
    mockKimiReturns('{"action":"gas_price","period":"1d"}');

    const result = await parseQuery('gas price yesterday');

    expect(result.action).toBe('gas_price');
    expect(result.period).toBe('1d');
  });

  // ── Edge cases: markdown wrappers ────────────────────────

  it('strips ```json markdown wrapper', async () => {
    mockKimiReturns('```json\n{"action":"wallet_balance","wallet":"xdc456"}\n```');

    const result = await parseQuery('balance xdc456');

    expect(result.action).toBe('wallet_balance');
    expect(result.wallet).toBe('xdc456');
  });

  it('strips ``` wrapper without json label', async () => {
    mockKimiReturns('```\n{"action":"block_info","blockNumber":12345}\n```');

    const result = await parseQuery('block 12345');

    expect(result.action).toBe('block_info');
    expect(result.blockNumber).toBe(12345);
  });

  // ── Error handling ───────────────────────────────────────

  it('falls back to unknown on invalid JSON', async () => {
    mockKimiReturns('not json at all');

    const result = await parseQuery('random gibberish');

    expect(result.action).toBe('unknown');
    expect(result.raw).toBe('random gibberish');
  });

  it('falls back to unknown on empty Kimi response', async () => {
    mockKimiReturns('');

    const result = await parseQuery('');

    expect(result.action).toBe('unknown');
  });

  it('falls back to unknown on hallucinated action', async () => {
    mockKimiReturns('{"action":"send_all_money","target":"hacker"}');

    const result = await parseQuery('send everything to 0xhack');

    expect(result.action).toBe('unknown');
  });

  it('falls back to unknown on missing action field', async () => {
    mockKimiReturns('{"wallet":"xdc789"}');

    const result = await parseQuery('missing action field');

    expect(result.action).toBe('unknown');
  });

  // ── Validation ───────────────────────────────────────────

  it('accepts all valid actions from VALID_ACTIONS list', async () => {
    const validActions: QueryAction[] = [
      QueryAction.WALLET_BALANCE,
      QueryAction.TRANSACTION_DETAIL,
      QueryAction.FAILED_CONTRACT_DEPLOYMENTS,
      QueryAction.CONTRACT_DEPLOYER,
      QueryAction.CONTRACT_VERIFICATION,
      QueryAction.GAS_PRICE,
      QueryAction.BLOCK_INFO,
      QueryAction.TOKEN_BALANCE,
      QueryAction.NFT_BALANCE,
      QueryAction.CREATE_ALERT,
      QueryAction.HELP,
    ];

    for (const action of validActions) {
      mockKimiReturns(JSON.stringify({ action, test: true }));
      const result = await parseQuery(`test ${action}`);
      expect(result.action).toBe(action);
    }
  });
});
