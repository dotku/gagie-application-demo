import OpenAI from 'openai';
import { NextResponse } from 'next/server';

// Rough estimate of tokens per character (this is an approximation)
const TOKENS_PER_CHAR = 0.25;
const MAX_TOKENS = 7000; // Leave some room for the system prompt and user query

function truncateText(text: string[], maxTokens: number): string[] {
  let totalChars = 0;
  const truncatedChunks: string[] = [];
  
  for (const chunk of text) {
    const estimatedTokens = totalChars * TOKENS_PER_CHAR;
    if (estimatedTokens >= maxTokens) {
      break;
    }
    truncatedChunks.push(chunk);
    totalChars += chunk.length;
  }
  
  return truncatedChunks;
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    const ragieApiKey = process.env.RAGIE_API_KEY;
    const openAiApiKey = process.env.OPENAI_API_KEY;

    const response = await fetch("https://api.ragie.ai/retrievals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + ragieApiKey,
      },
      body: JSON.stringify({ query, filters: { scope: "tutorial" }}),
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve data from Ragie API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let chunkText = data.scored_chunks.map((chunk: any) => chunk.text);
    
    // Truncate chunks to fit within token limit
    chunkText = truncateText(chunkText, MAX_TOKENS);
    
    const systemPrompt = `These are very important to follow:

    You are "Ragie AI", a professional but friendly AI chatbot working as an assistant to the user.

    Your current task is to help the user based on all of the information available to you shown below.
    Answer informally, directly, and concisely without a heading or greeting but include everything relevant.
    Use richtext Markdown when appropriate including bold, italic, paragraphs, and lists when helpful.
    If using LaTeX, use double $$ as delimiter instead of single $. Use $$...$$ instead of parentheses.
    Organize information into multiple sections or points when appropriate.
    Don't include raw item IDs or other raw fields from the source.
    Don't use XML or other markup unless requested by the user.

    Here is all of the information available to answer the user:
    ===
    ${chunkText.join('\n')}
    ===

    If the user asked for a search and there are no results, make sure to let the user know that you couldn't find anything,
    and what they might be able to do to find the information they need.

    END SYSTEM INSTRUCTIONS`;

    const openai = new OpenAI({ apiKey: openAiApiKey });
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      model: "gpt-4",
      max_tokens: 1000, // Limit response length
    });

    return NextResponse.json({ content: chatCompletion.choices[0].message.content });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
