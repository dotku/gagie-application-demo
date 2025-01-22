import OpenAI from "openai";
import { NextResponse } from "next/server";

// Rough estimate of tokens per character (this is an approximation)
const TOKENS_PER_CHAR = 0.25;
// Reserve tokens for system prompt (1000), user query (500), and response (1000)
const MAX_CONTEXT_TOKENS = 5500;

function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

function truncateText(chunks: string[], maxTokens: number): string[] {
  let totalTokens = 0;
  const truncatedChunks: string[] = [];

  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk);
    if (totalTokens + chunkTokens > maxTokens) {
      break;
    }
    truncatedChunks.push(chunk);
    totalTokens += chunkTokens;
  }

  return truncatedChunks;
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    // Validate query
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    // Get API keys
    const ragieApiKey = process.env.RAGIE_API_KEY;
    const openAiApiKey = process.env.OPENAI_API_KEY;

    if (!ragieApiKey || !openAiApiKey) {
      console.error("Missing required environment variables");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    let response;
    try {
      response = await fetch("https://api.ragie.ai/retrievals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: "Bearer " + ragieApiKey,
        },
        body: JSON.stringify({ query, filters: { scope: "tutorial" } }),
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Ragie API network error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 503 });
      } else {
        console.error("Ragie API network error:", error);
        return NextResponse.json(
          { error: "Failed to connect to Ragie API" },
          { status: 503 }
        );
      }
    }

    if (!response.ok) {
      console.error(
        `Ragie API error: ${response.status} ${response.statusText}`
      );
      return NextResponse.json(
        { error: "Failed to retrieve data from Ragie API" },
        { status: response.status }
      );
    }

    // Parse and validate Ragie response
    const data = await response.json();
    console.log("ragie rspond", data);
    if (!data.scored_chunks || !Array.isArray(data.scored_chunks)) {
      console.error("Invalid response from Ragie API:", data);
      return NextResponse.json(
        { error: "Invalid response from Ragie API" },
        { status: 502 }
      );
    }

    let chunkText = data.scored_chunks
      .map((chunk: any) => (typeof chunk.text === "string" ? chunk.text : ""))
      .filter(Boolean);

    // Handle no results case
    if (chunkText.length === 0) {
      return NextResponse.json({
        content:
          "I couldn't find any relevant information for your query. Could you try rephrasing your question or using different keywords?",
      });
    }

    // Sort chunks by length (longest first)
    chunkText.sort((a, b) => b.length - a.length);

    // Truncate chunks to fit within token limit
    chunkText = truncateText(chunkText, MAX_CONTEXT_TOKENS);

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
${chunkText}
===

If the user asked for a search and there are no results, make sure to let the user know that you couldn't find anything,
and what they might be able to do to find the information they need.

END SYSTEM INSTRUCTIONS`;

    let chatCompletion;
    try {
      const openai = new OpenAI({ apiKey: openAiApiKey });
      chatCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        max_tokens: 1000, // Limit response length
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("OpenAI API error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 502 });
      } else {
        console.error("OpenAI API error:", error);
        return NextResponse.json(
          { error: "Failed to generate response" },
          { status: 502 }
        );
      }
    }

    // Validate OpenAI response
    if (!chatCompletion?.choices?.[0]?.message?.content) {
      console.error("Invalid response from OpenAI:", chatCompletion);
      return NextResponse.json(
        { error: "Invalid response from OpenAI" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      content: chatCompletion.choices[0].message.content,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Unhandled error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      console.error("Unhandled error:", error);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  }
}
