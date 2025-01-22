import OpenAI from "openai";
import { NextResponse } from "next/server";
import { encode } from "gpt-tokenizer";

const ragieApiKey = process.env.RAGIE_API_KEY;
const openAiApiKey = process.env.OPENAI_API_KEY;

if (!ragieApiKey || !openAiApiKey) {
  throw new Error("Missing required API keys");
}

const openai = new OpenAI({ apiKey: openAiApiKey });

// Constants for token management
const MAX_TOKENS = 4096; // GPT-4's maximum context length
const MAX_RESPONSE_TOKENS = 1000; // Reserve tokens for the response
const SYSTEM_PROMPT_TOKENS = 500; // Approximate tokens for system prompt
const MAX_CONTEXT_TOKENS = MAX_TOKENS - MAX_RESPONSE_TOKENS - SYSTEM_PROMPT_TOKENS;
const MAX_TOKENS_PER_MESSAGE = 1000; // Maximum tokens for a single message

interface Message {
  role: string;
  content: string;
  timestamp?: string;
}

// Function to ensure a single message doesn't exceed token limit
function truncateMessage(message: Message): Message {
  const tokens = encode(message.content);
  if (tokens.length <= MAX_TOKENS_PER_MESSAGE) {
    return message;
  }

  // Decode only the tokens we want to keep
  const truncatedContent = tokens
    .slice(0, MAX_TOKENS_PER_MESSAGE - 50) // Leave room for ellipsis
    .map(token => String.fromCharCode(token))
    .join("");

  return {
    ...message,
    content: truncatedContent + "... (message truncated due to length)",
  };
}

// Function to truncate conversation history to fit token limit
function truncateConversationHistory(messages: Message[], maxTokens: number): Message[] {
  // First, truncate any overly long messages
  let truncatedMessages = messages.map(truncateMessage);
  
  const tokenCounts = truncatedMessages.map(msg => encode(msg.content).length);
  let totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);
  
  // Start removing older messages until we're under the limit
  while (totalTokens > maxTokens && truncatedMessages.length > 1) {
    const removedMessage = truncatedMessages.shift(); // Remove the oldest message
    if (removedMessage) {
      totalTokens -= encode(removedMessage.content).length;
    }
  }

  // If we still exceed the limit with just one message, truncate it further
  if (truncatedMessages.length === 1 && totalTokens > maxTokens) {
    const singleMessage = truncatedMessages[0];
    const tokens = encode(singleMessage.content);
    const truncatedContent = tokens
      .slice(0, maxTokens - 50)
      .map(token => String.fromCharCode(token))
      .join("");

    truncatedMessages = [{
      ...singleMessage,
      content: truncatedContent + "... (message truncated due to length)",
    }];
  }
  
  return truncatedMessages;
}

// Function to truncate context to fit token limit
function truncateContext(chunks: string[], maxTokens: number): string[] {
  let totalTokens = 0;
  const truncatedChunks: string[] = [];

  for (const chunk of chunks) {
    const tokenCount = encode(chunk).length;
    if (totalTokens + tokenCount > maxTokens) {
      // If this is the first chunk and it's too long, truncate it
      if (truncatedChunks.length === 0) {
        const tokens = encode(chunk);
        const truncatedContent = tokens
          .slice(0, maxTokens - 50)
          .map(token => String.fromCharCode(token))
          .join("");
        truncatedChunks.push(truncatedContent + "... (truncated)");
      }
      break;
    }
    truncatedChunks.push(chunk);
    totalTokens += tokenCount;
  }

  return truncatedChunks;
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage?.content) {
      return NextResponse.json(
        { error: "Invalid message content" },
        { status: 400 }
      );
    }

    const query = lastMessage.content;

    // Get context from Ragie AI
    const ragieResponse = await fetch("https://api.ragie.ai/retrievals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + ragieApiKey,
      },
      body: JSON.stringify({ query, filters: { scope: "tutorial" } }),
    });

    if (!ragieResponse.ok) {
      throw new Error(
        `Failed to retrieve data from Ragie API: ${ragieResponse.status} ${ragieResponse.statusText}`
      );
    }

    const ragieData = await ragieResponse.json();
    
    if (!Array.isArray(ragieData.scored_chunks)) {
      throw new Error("Invalid response format from Ragie API");
    }

    let chunkText = ragieData.scored_chunks.map((chunk: any) => chunk.text);

    // Sort chunks by relevance score if available
    if (ragieData.scored_chunks[0]?.score) {
      chunkText.sort((a: any, b: any) => b.score - a.score);
    }

    // Truncate context to fit within token limits
    chunkText = truncateContext(chunkText, MAX_CONTEXT_TOKENS / 2); // Use half for context

    const systemPrompt = `These are very important to follow:

You are "Ragie AI", a professional but friendly AI chatbot working as an assitant to the user.

Your current task is to help the user based on all of the information available to you shown below.
Answer informally, directly, and concisely without a heading or greeting but include everything relevant.
Use richtext Markdown when appropriate including bold, italic, paragraphs, and lists when helpful.
If using LaTeX, use double $$ as delimiter instead of single $. Use $$...$$ instead of parentheses.
Organize information into multiple sections or points when appropriate.
Don't include raw item IDs or other raw fields from the source.
Don't use XML or other markup unless requested by the user.

Here is all of the information available to answer the user:
===
${chunkText.join("\n")}
===

If the user asked for a search and there are no results, make sure to let the user know that you couldn't find anything,
and what they might be able to do to find the information they need.

END SYSTEM INSTRUCTIONS`;

    // Truncate conversation history to fit remaining token limit
    const conversationHistory = truncateConversationHistory(
      messages.slice(0, -1),
      MAX_CONTEXT_TOKENS / 2 // Use remaining half for conversation history
    );

    // Get response from OpenAI
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: query },
      ],
      model: "gpt-4",
      max_tokens: MAX_RESPONSE_TOKENS,
    });

    if (!chatCompletion.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from OpenAI");
    }

    return NextResponse.json({
      message: chatCompletion.choices[0].message.content,
    });
  } catch (error) {
    console.error("Chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: errorMessage },
      { status: error instanceof Error && error.message.includes("Invalid") ? 400 : 500 }
    );
  }
}
