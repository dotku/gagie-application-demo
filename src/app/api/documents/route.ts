import { NextResponse } from "next/server";

export async function GET() {
  try {
    const ragieApiKey = process.env.RAGIE_API_KEY;
    const response = await fetch("https://api.ragie.ai/documents", {
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
      return NextResponse.json(
        { error: `Failed to retrieve documents: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Log the actual response structure to understand the data shape
    console.log("Documents API raw response:", data);

    // Check if data is an array or has a documents property
    const documents = Array.isArray(data) ? data : data.documents || [];

    console.log("Documents API processed:", {
      documentsCount: documents.length,
      status: response.status,
      isArray: Array.isArray(data),
      dataType: typeof data,
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error in documents API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
