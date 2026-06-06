// ============================================================
// Live test: Run parseQuery() on real inputs and see output.
// This tests Phase 6 end-to-end with the mock fallback.
// ============================================================

import { parseQuery } from '../src/services/ai/queryParser';

const TEST_INPUTS = [
  'Show failed contract deploys last week',
  "What's the balance of xdc123?",
  'Who deployed this contract?',
  'Tx 0xabc123',
  'gas price yesterday',
  'block 12345',
  'Alert me when XDC drops below $0.02',
  'random gibberish that makes no sense',
];

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Phase 6 Live Output — queryParser.ts Demo              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  for (const input of TEST_INPUTS) {
    console.log('─'.repeat(60));
    console.log('📝 INPUT:', input);
    console.log('─'.repeat(60));

    const result = await parseQuery(input);

    console.log('✅ OUTPUT:');
    console.log(JSON.stringify(result, null, 2));
    console.log();
  }

  console.log('═'.repeat(60));
  console.log('✅ All inputs processed successfully!');
  console.log('═'.repeat(60));
}

main().catch(console.error);
