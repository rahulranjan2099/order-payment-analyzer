import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

let llmInstance: ChatGoogleGenerativeAI | null = null;

export const getLlm = (): ChatGoogleGenerativeAI => {
  if (llmInstance) {
    return llmInstance;
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  const aiModel = process.env.GOOGLE_MODEL || "gemini-2.5-flash"
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not configured");
  }

  llmInstance = new ChatGoogleGenerativeAI({
    model: aiModel,
    temperature: 0,
    apiKey,
  });

  return llmInstance;
};