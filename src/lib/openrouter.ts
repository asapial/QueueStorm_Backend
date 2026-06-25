import { env } from "../config/env.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
// const MODEL = "google/gemma-3-4b-it:free";
const MODEL = "google/gemma-4-31b-it:free";

/**
 * Sends a prompt to OpenRouter and returns the model's raw text response.
 */
export const chatWithAI = async (fullPrompt: string): Promise<string> => {
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: fullPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error("OpenRouter error:", JSON.stringify(err, null, 2));
    throw { status: response.status, message: "AI service error" };
  }

  const result = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = result.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }

  return content.trim();
};
