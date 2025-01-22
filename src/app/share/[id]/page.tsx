import React from 'react';
import { Metadata } from 'next';

interface SharePageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/share?id=${params.id}`);
    const data = await response.json();
    
    return {
      title: data.query ? `Q: ${data.query}` : 'Shared Answer',
      description: data.response.substring(0, 160) + '...',
    };
  } catch {
    return {
      title: 'Shared Content',
      description: 'View shared content from Ragie AI',
    };
  }
}

export default async function SharePage({ params }: SharePageProps) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/share?id=${params.id}`);
  const data = await response.json();

  if (!response.ok) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Content Not Found</h1>
          <p className="text-gray-400">This shared content may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-6">
          {data.query && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-300 mb-2">Question</h2>
              <p className="text-white">{data.query}</p>
            </div>
          )}
          
          <div>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">Answer</h2>
            <div className="prose prose-invert max-w-none">
              {data.response}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Ragie AI
          </a>
        </div>
      </div>
    </div>
  );
}
