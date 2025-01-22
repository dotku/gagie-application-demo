import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log("get summary");
  try {
    const ragieApiKey = process.env.RAGIE_API_KEY;
    const documentId = params.id;

    console.log("Fetching summary for document:", documentId);

    if (!documentId) {
      console.error("No document ID provided");
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    const url = `https://api.ragie.ai/documents/${documentId}/summary`;
    console.log("Calling RAGIE API:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: "Bearer " + ragieApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("RAGIE API error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(
        `Failed to retrieve document summary: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("RAGIE API response:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in summary API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
