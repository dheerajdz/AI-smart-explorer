import OpenAI from "openai";
import dotenv from "dotenv";
import { QUERY_PARSER_PROMPT } from "./prompt/promptTemplates";
dotenv.config();

console.log("KEY:", process.env.KIMI_API_KEY);

const client = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: "https://api.moonshot.ai/v1",
});

export async function parseUserQuery(userMessage: string) {
  const response = await client.chat.completions.create({
    model: "moonshot-v1-8k",
    messages: [
      {
        role: "system",
        content: QUERY_PARSER_PROMPT,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    temperature: 0,
  });

  return JSON.parse(
    response.choices[0].message.content || "{}"
  );
}
export async function formatResponse(
  userQuery: string,
  blockchainData: any
) {
  const response = await client.chat.completions.create({
    model: "moonshot-v1-8k",
    messages: [
      {
        role: "system",
        content: `
You are a blockchain assistant.

Convert blockchain API data into a simple,
human-readable response.

Do not return JSON.
`,
      },
      {
        role: "user",
        content: `
User Query:
${userQuery}

Blockchain Data:
${JSON.stringify(blockchainData)}
`,
      },
    ],
    temperature: 0.3,
  });

  return response.choices[0].message.content;
}