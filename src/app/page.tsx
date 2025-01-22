'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import type { ChatHistory } from '@/utils/supabase';

export default function Home() {
  const { user, signIn, signUp, signOut, loading: authLoading } = useAuth();
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatHistory[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatHistory | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [documentContent, setDocumentContent] = useState<any>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (user) {
      loadChatHistory();
    }
  }, [user]);

  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const response = await fetch("/api/documents");
      if (!response.ok) {
        throw new Error(`Failed to load documents: ${response.status}`);
      }
      const data = await response.json();
      // Ensure data is an array and handle sorting safely
      const docs = Array.isArray(data) ? data : [];
      const sortedDocs = [...docs]  // Create a copy before sorting
        .filter(doc => doc && doc.created_at)  // Filter out invalid entries
        .sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;  // Most recent first
        })
        .slice(0, 3);
      setDocuments(sortedDocs);
    } catch (error) {
      console.error("Error loading documents:", error);
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const loadChatHistory = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading chat history:', error);
      return;
    }

    setHistory(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setResponse(data.content);

      // Save to Supabase only if user is logged in
      if (user) {
        const { error } = await supabase
          .from('chat_history')
          .insert({
            user_id: user.id,
            query,
            response: data.content,
            is_public: false,
          });

        if (error) {
          console.error('Error saving chat:', error);
        } else {
          loadChatHistory();
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setResponse('An error occurred while processing your request.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    const { error } = await (isSignUp ? signUp(email, password) : signIn(email, password));
    
    if (error) {
      setAuthError(error.message);
    } else {
      setShowAuthForm(false);
      setEmail('');
      setPassword('');
    }
  };

  const togglePrivacy = async (chatId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('chat_history')
      .update({ is_public: !currentStatus })
      .eq('id', chatId);

    if (error) {
      console.error('Error updating privacy:', error);
      return;
    }

    loadChatHistory();
  };

  const shareToX = () => {
    const tweetText = encodeURIComponent(`Q: ${query}\n\nA: ${response.slice(0, 240)}...`);
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank');
  };

  const handleDocumentClick = async (doc: any) => {
    if (!doc?.id) return;
    
    setSelectedDocument(doc);
    setLoadingContent(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/content`);
      if (!res.ok) {
        throw new Error(`Failed to load content: ${res.status}`);
      }
      const data = await res.json();
      setDocumentContent(data);
    } catch (error) {
      console.error('Error loading document content:', error);
      setDocumentContent(null);
    } finally {
      setLoadingContent(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {showAuthForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">{isSignUp ? 'Sign Up' : 'Sign In'}</h2>
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              {authError && (
                <p className="text-red-400 text-sm">{authError}</p>
              )}
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium"
                >
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAuthForm(false)}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Continue as Guest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-3xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setSelectedDocument(null);
                setDocumentContent(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {loadingContent ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : documentContent ? (
              <div className="space-y-6">
                {/* Header Section */}
                <div>
                  <h2 className="text-xl font-semibold">{documentContent.name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full ml-2 ${
                      documentContent.status === 'ready' 
                        ? 'bg-green-600' 
                        : documentContent.status === 'processing'
                        ? 'bg-yellow-600'
                        : 'bg-gray-600'
                    }`}>
                      {documentContent.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(documentContent.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Content</h3>
                  <p className="text-sm text-gray-200 leading-relaxed">
                    {documentContent.content || 'No content available'}
                  </p>
                </div>

                {/* Metadata Section */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Document Details</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {documentContent.metadata?.folder && (
                      <div className="col-span-2">
                        <span className="text-xs text-gray-400">Folder:</span>
                        <span className="text-xs text-gray-200 ml-2">{documentContent.metadata.folder}</span>
                      </div>
                    )}
                    {documentContent.metadata?.file_path && (
                      <div className="col-span-2">
                        <span className="text-xs text-gray-400">File Path:</span>
                        <span className="text-xs text-gray-200 ml-2 break-all">
                          {documentContent.metadata.file_path}
                        </span>
                      </div>
                    )}
                    {documentContent.metadata?.source_type && (
                      <div>
                        <span className="text-xs text-gray-400">Source Type:</span>
                        <span className="text-xs text-gray-200 ml-2">
                          {documentContent.metadata.source_type}
                        </span>
                      </div>
                    )}
                    {documentContent.chunk_count !== undefined && (
                      <div>
                        <span className="text-xs text-gray-400">Chunks:</span>
                        <span className="text-xs text-gray-200 ml-2">
                          {documentContent.chunk_count}
                        </span>
                      </div>
                    )}
                    {documentContent.partition && (
                      <div>
                        <span className="text-xs text-gray-400">Partition:</span>
                        <span className="text-xs text-gray-200 ml-2">
                          {documentContent.partition}
                        </span>
                      </div>
                    )}
                    {documentContent.metadata?.created_at && (
                      <div>
                        <span className="text-xs text-gray-400">Created:</span>
                        <span className="text-xs text-gray-200 ml-2">
                          {new Date(documentContent.metadata.created_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Section */}
                <div className="flex justify-end gap-2">
                  {documentContent.metadata?.source_url && (
                    <a
                      href={documentContent.metadata.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm"
                    >
                      View Source
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setSelectedDocument(null);
                      setDocumentContent(null);
                      setQuery(`Tell me about "${documentContent.name}"`);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                  >
                    Ask About This Document
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                Failed to load document content. Please try again.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
              Ragie AI Chat
            </h1>
            <p className="text-gray-300 text-lg">
              Ask anything about Chamath's thoughts and perspectives
            </p>
          </div>
          <div>
            {!authLoading && (
              user ? (
                <button
                  onClick={() => signOut()}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={() => setShowAuthForm(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Sign In
                </button>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Recent Documents Section */}
          <div className="flex-none w-72 bg-gray-800 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Documents</h2>
              <button
                onClick={loadDocuments}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Refresh
              </button>
            </div>

            {loadingDocs ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc, index) => (
                  <div
                    key={doc.id || index}
                    className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer"
                    onClick={() => doc && handleDocumentClick(doc)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm truncate flex-1 mr-2">{doc.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        doc.status === 'ready' 
                          ? 'bg-green-600' 
                          : doc.status === 'processing'
                          ? 'bg-yellow-600'
                          : 'bg-gray-600'
                      }`}>
                        {doc.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {doc.metadata?.folder && (
                        <span className="text-xs text-gray-400">
                          📁 {doc.metadata.folder}
                        </span>
                      )}
                      {doc.metadata?.source_type && (
                        <span className="text-xs text-gray-400">
                          🔗 {doc.metadata.source_type}
                        </span>
                      )}
                      {doc.chunk_count > 0 && (
                        <span className="text-xs text-gray-400">
                          📄 {doc.chunk_count} chunk{doc.chunk_count > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {doc.created_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Added {new Date(doc.created_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 bg-gray-700 rounded-lg">
                <p className="text-gray-400">No documents available</p>
                <button
                  onClick={loadDocuments}
                  className="text-sm text-blue-400 hover:text-blue-300 mt-2"
                >
                  Try refreshing
                </button>
              </div>
            )}
          </div>

          {/* Chat History Sidebar */}
          {user && (
            <div className="md:col-span-1 bg-gray-800 rounded-lg shadow-xl p-6 h-[calc(100vh-200px)] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">Chat History</h2>
              <div className="space-y-4">
                {history.map((chat) => (
                  <div
                    key={chat.id}
                    className="p-4 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => {
                      setSelectedChat(chat);
                      setQuery(chat.query);
                      setResponse(chat.response);
                    }}
                  >
                    <p className="font-medium truncate">{chat.query}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-gray-400">
                        {new Date(chat.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePrivacy(chat.id, chat.is_public);
                        }}
                        className={`text-sm px-2 py-1 rounded ${
                          chat.is_public
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-gray-600 hover:bg-gray-500'
                        }`}
                      >
                        {chat.is_public ? 'Public' : 'Private'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat Interface */}
          <div className={`${user ? 'md:col-span-1' : 'md:col-span-2'}`}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-8">
              <form onSubmit={handleSubmit} className="mb-6">
                <div className="flex flex-col gap-4">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask a question..."
                    className="w-full p-4 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      'Ask Question'
                    )}
                  </button>
                </div>
              </form>
            </div>

            {response && (
              <div className="bg-gray-800 rounded-lg shadow-xl p-6">
                <div className="prose prose-invert max-w-none">
                  <div className="whitespace-pre-wrap mb-4">{response}</div>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                  {selectedChat && user && (
                    <button
                      onClick={() => togglePrivacy(selectedChat.id, selectedChat.is_public)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                        selectedChat.is_public
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {selectedChat.is_public ? 'Make Private' : 'Make Public'}
                    </button>
                  )}
                  <button
                    onClick={shareToX}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-200"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5 fill-current"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Share on X
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
