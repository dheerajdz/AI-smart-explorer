import { parseQuery, formatResponse } from "./services/ai";

async function runTest() {
  // Step 1: test query parsing
  const parsed = await parseQuery(
    "Show failed contract deploys last week"
  );

  console.log("PARSED RESULT:", parsed);

  // Step 2: test response formatting (mock data)
  const formatted = await formatResponse({
    total: 5,
    failedTxs: [
      { hash: "0x123", reason: "Out of gas" },
      { hash: "0x456", reason: "Revert" },
    ],
  });

  console.log("FORMATTED RESPONSE:", formatted);
}

runTest();
