import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

// In-memory store for shares (replace with database in production)
const shares = new Map<string, { query: string | null; response: string }>();

export async function POST(req: Request) {
  try {
    const { query, response } = await req.json();

    // Validate response
    if (!response || typeof response !== 'string') {
      return NextResponse.json(
        { error: 'Response is required and must be a string' },
        { status: 400 }
      );
    }

    // Generate unique ID for the share
    const shareId = nanoid();

    // Store the share data
    shares.set(shareId, { query, response });

    return NextResponse.json({ shareId });
  } catch (error) {
    console.error('Share creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create share' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shareId = url.searchParams.get('id');

    if (!shareId) {
      return NextResponse.json(
        { error: 'Share ID is required' },
        { status: 400 }
      );
    }

    const share = shares.get(shareId);
    if (!share) {
      return NextResponse.json(
        { error: 'Share not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(share);
  } catch (error) {
    console.error('Share retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve share' },
      { status: 500 }
    );
  }
}
