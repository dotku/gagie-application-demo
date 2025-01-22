import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ragieApiKey = process.env.RAGIE_API_KEY;
    const documentId = params.id;

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.ragie.ai/documents/${documentId}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: "Bearer " + ragieApiKey,
        },
      }
    );
    if (response.ok) {
      const data = await response.json();
      console.log("data", data);
      return NextResponse.json(data);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("RAGIE API error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return NextResponse.json(
        { error: `Failed to retrieve document: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("data", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in document API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
