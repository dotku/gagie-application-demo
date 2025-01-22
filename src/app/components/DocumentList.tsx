import React from 'react';

interface DocumentListProps {
  documents: any[];
  selectedDocument: any;
  onDocumentClick: (doc: any) => void;
  loading: boolean;
  onRefresh: () => void;
}

export function DocumentList({
  documents,
  selectedDocument,
  onDocumentClick,
  loading,
  onRefresh,
}: DocumentListProps) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-300">Recent Documents</h2>
        <button
          onClick={onRefresh}
          className="text-gray-400 hover:text-white transition-colors duration-200"
          title="Refresh documents"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-400/30 border-b-gray-400"></div>
        </div>
      ) : documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => onDocumentClick(doc)}
              className={`w-full text-left p-3 rounded-lg transition-colors duration-200 border border-transparent ${
                selectedDocument?.id === doc.id
                  ? "bg-blue-600/20 text-white border-blue-500/50"
                  : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
              }`}
            >
              <div className="font-medium truncate">{doc.title || doc.name}</div>
              <div className="text-sm text-gray-500 truncate mt-1">
                {new Date(doc.created_at).toLocaleDateString()}
              </div>
              {doc.status && (
                <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${
                  doc.status === 'ready' 
                    ? 'bg-green-500/20 text-green-400' 
                    : doc.status === 'processing'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {doc.status}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400">No documents available</p>
        </div>
      )}
    </div>
  );
}
