"use client";

import React, { useState, useEffect } from "react";
import { DocumentList } from "./components/DocumentList";
import { ChatHistory } from "./components/ChatHistory";
import { ShareModal } from "./components/ShareModal";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/utils/supabase";
import type { ChatHistory } from "@/utils/supabase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { shareOnX, formatDocumentForSharing } from "@/utils/share";

export default function Home() {
  // State declarations
  const { user, signIn, signUp, signOut, loading: authLoading } = useAuth();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [history, setHistory] = useState<ChatHistory[]>([]);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"documents" | "history">(
    "documents"
  );
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (user) {
      loadChatHistory();
    }
  }, [user]);

  // API interaction functions
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
      const sortedDocs = [...docs] // Create a copy before sorting
        .filter((doc) => doc && doc.created_at) // Filter out invalid entries
        .sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA; // Most recent first
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
      .from("chat_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading chat history:", error);
      return;
    }

    setHistory(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setChatError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      setResponse(data.content);

      // Save to Supabase only if user is logged in
      if (user) {
        const { error: supabaseError } = await supabase
          .from("chat_history")
          .insert({
            user_id: user.id,
            query,
            response: data.content,
            is_public: false,
          });

        if (supabaseError) {
          console.error("Error saving chat:", supabaseError);
          // Don't throw here, just log the error since the chat was successful
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      setChatError(error.message || "Failed to get response");
      setResponse(""); // Clear any partial response
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const { error } = await signIn(email, password);

    if (error) {
      setAuthError(error.message);
    } else {
      setShowAuthForm(false);
      setEmail("");
      setPassword("");
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);

    try {
      const response = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoveryEmail }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send recovery email");
      }

      setRecoverySuccess(true);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePrivacy = async (chatId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("chat_history")
      .update({ is_public: !currentStatus })
      .eq("id", chatId);

    if (error) {
      console.error("Error updating privacy:", error);
      return;
    }

    loadChatHistory();
  };

  const handleXShare = (chat: any, includeQuestion: boolean) => {
    let text;
    if (includeQuestion) {
      text = `Q: ${chat.query}\nA: ${chat.response}`;
    } else {
      text = chat.response;
    }
    
    const truncatedText = text.length > 255
      ? text.substring(0, 250) + '...'
      : text;

    const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(truncatedText);
    window.open(url, '_blank');
  };

  const handleLinkedInShare = (chat: any, includeQuestion: boolean) => {
    const text = includeQuestion
      ? `Q: ${chat.query}\n\nA: ${chat.response}`
      : chat.response;

    const sourceUrl = window.location.origin;
    
    // Include both text content and source URL
    const url = `https://www.linkedin.com/feed/?linkOrigin=LI_BADGE&shareActive=true&text=${encodeURIComponent(text)}&url=${encodeURIComponent(sourceUrl)}`;
    window.open(url, '_blank');
  };

  const handleDocumentClick = async (doc: any) => {
    if (!doc?.id) return;

    setSelectedDocument(doc);
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/content`);
      if (!res.ok) {
        throw new Error(`Failed to load content: ${res.status}`);
      }
      const data = await res.json();
      setResponse(data);
    } catch (error) {
      console.error("Error loading document content:", error);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (chat: any, includeQuestion: boolean) => {
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: includeQuestion ? chat.query : null,
          response: chat.response,
        }),
      });

      if (!response.ok) throw new Error("Failed to create share link");

      const { shareId } = await response.json();
      const url = `${window.location.origin}/share/${shareId}`;
      setShareUrl(url);
      setShowShareModal(true);
    } catch (error) {
      console.error("Share error:", error);
      alert("Failed to create share link");
    }
  };

  return (
    <main className="flex-1 flex flex-col h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-700/50 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">
            RAGIE AI
          </h1>
          <div className="flex items-center gap-4">
            {user ? (
              <button
                onClick={() => signOut()}
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                Sign Out
              </button>
            ) : (
              <button
                onClick={() => setShowAuthForm(true)}
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-72 border-r border-gray-700/50 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-700/50">
            <button
              onClick={() => setSidebarTab("documents")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                sidebarTab === "documents"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Documents
            </button>
            <button
              onClick={() => setSidebarTab("history")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                sidebarTab === "history"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Chat History
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {sidebarTab === "documents" ? (
              <DocumentList
                documents={documents}
                selectedDocument={selectedDocument}
                onDocumentClick={handleDocumentClick}
                loading={loadingDocs}
                onRefresh={loadDocuments}
              />
            ) : (
              <ChatHistory
                history={history}
                onChatSelect={(query, response) => {
                  setQuery(query);
                  setResponse(response);
                }}
                onShare={handleShare}
                onXShare={handleXShare}
                onLinkedInShare={handleLinkedInShare}
                onTogglePrivacy={togglePrivacy}
                onShowAuthForm={() => setShowAuthForm(true)}
                user={user}
              />
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {chatError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 mb-4">
                  <p className="text-red-400 text-sm">{chatError}</p>
                  <button
                    onClick={() => setChatError(null)}
                    className="text-red-400 hover:text-red-300 text-sm mt-1"
                  >
                    Try again
                  </button>
                </div>
              )}

              {query && (
                <div className="bg-blue-600/20 rounded-lg p-4">
                  <p className="text-white">{query}</p>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center space-x-2 text-gray-400 my-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400/30 border-b-gray-400"></div>
                  <span>Generating response...</span>
                </div>
              ) : response ? (
                <div className="bg-gray-800/50 rounded-lg p-6 mb-4">
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {response}
                    </ReactMarkdown>
                  </div>
                  {/* Share Buttons */}
                  <div className="flex items-center gap-2 mt-4 border-t border-gray-700/50 pt-4">
                    {/* X Share Buttons */}
                    <button
                      onClick={() => handleXShare({ query, response }, true)}
                      className="text-sm px-3 py-1.5 rounded bg-gray-800/50 text-blue-400 hover:text-blue-300 hover:bg-gray-800 flex items-center gap-2 transition-colors duration-200"
                      title="Share on X with question and answer"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span>X share with question and answer</span>
                    </button>
                    <button
                      onClick={() => handleXShare({ query, response }, false)}
                      className="text-sm px-3 py-1.5 rounded bg-gray-800/50 text-blue-400 hover:text-blue-300 hover:bg-gray-800 flex items-center gap-2 transition-colors duration-200"
                      title="Share on X without question"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span>X share with respond content only</span>
                    </button>

                    {/* LinkedIn Share Buttons */}
                    <div className="border-l border-gray-700/50 pl-2 flex items-center gap-2">
                      <button
                        onClick={() => handleLinkedInShare({ query, response }, true)}
                        className="text-sm px-3 py-1.5 rounded bg-gray-800/50 text-blue-400 hover:text-blue-300 hover:bg-gray-800 flex items-center gap-2 transition-colors duration-200"
                        title="Share on LinkedIn with question and answer"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
                      </svg>
                      <span>LinkedIn share with Q&A</span>
                    </button>
                      <button
                        onClick={() => handleLinkedInShare({ query, response }, false)}
                        className="text-sm px-3 py-1.5 rounded bg-gray-800/50 text-blue-400 hover:text-blue-300 hover:bg-gray-800 flex items-center gap-2 transition-colors duration-200"
                        title="Share on LinkedIn without question"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
                      </svg>
                      <span>LinkedIn share content only</span>
                    </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Chat Input */}
          <div className="border-t border-gray-700 p-4">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask me anything..."
                  className="flex-1 bg-gray-800/50 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-gray-700/50"
                />
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-xl px-6 py-3 transition-colors duration-200 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-b-white"></div>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 transform rotate-90 -translate-x-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                      <span>Send</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && shareUrl && (
        <ShareModal url={shareUrl} onClose={() => setShowShareModal(false)} />
      )}

      {/* Auth Modal */}
      {showAuthForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          {/* ... Auth modal content ... */}
        </div>
      )}
    </main>
  );
}
