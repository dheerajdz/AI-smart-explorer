import { parseQuery, formatResponse } from "./services/ai";
import { logger } from "./utils/logger";

async function runTest() {
  // Step 1: test query parsing
  const parsed = await parseQuery(
    "Show failed contract deploys last week"
  );

  logger.info("PARSED RESULT:", parsed);

  // Step 2: test response formatting (mock data)
  const formatted = await formatResponse({
    total: 5,
    failedTxs: [
      { hash: "0x123", reason: "Out of gas" },
      { hash: "0x456", reason: "Revert" },
    ],
  });

  logger.info("FORMATTED RESPONSE:", formatted);
}

runTest();
