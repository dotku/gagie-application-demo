import React from 'react';

interface ShareModalProps {
  url: string;
  onClose: () => void;
}

export function ShareModal({ url, onClose }: ShareModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Share Link</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            readOnly
            className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(url);
              alert('Link copied to clipboard!');
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}
