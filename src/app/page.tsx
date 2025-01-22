"use client";

import React, { useState, useEffect } from "react";
import { DocumentList } from "./components/DocumentList";
import { ChatHistory } from "./components/ChatHistory";
import { ShareModal } from "./components/ShareModal";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/utils/supabase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Home() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [history, setHistory] = useState([]);
  const [chatError, setChatError] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("documents");
  const [shareUrl, setShareUrl] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [userState, setUserState] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    loadDocuments();

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserState(user);
      if (user) {
        loadChatHistory();
      }
    });

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserState(session?.user ?? null);
      if (session?.user) {
        loadChatHistory();
      } else {
        setChatHistory([]);
        setActiveChat(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChatHistory(data || []);
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  };

  const createNewChat = async () => {
    if (!userState) return;

    try {
      const { data, error } = await supabase
        .from("chats")
        .insert([
          {
            user_id: userState.id,
            title: "New Chat",
            messages: [],
            is_public: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setChatHistory([data, ...chatHistory]);
      setActiveChat(data.id);
      setMessages([]);
      setChatTitle("New Chat");
    } catch (error) {
      console.error("Error creating new chat:", error);
    }
  };

  const saveMessage = async (chatId: string, query: string, response: string) => {
    if (!userState) return;

    try {
      const newMessage = {
        role: "user",
        content: query,
        timestamp: new Date().toISOString(),
      };
      const newResponse = {
        role: "assistant",
        content: response,
        timestamp: new Date().toISOString(),
      };

      const { data: chat } = await supabase
        .from("chats")
        .select("messages, title")
        .eq("id", chatId)
        .single();

      const messages = [...(chat?.messages || []), newMessage, newResponse];
      const title =
        chat?.title === "New Chat" ? query.slice(0, 50) : chat?.title;

      const { error } = await supabase
        .from("chats")
        .update({
          messages,
          title,
          last_message: query,
          updated_at: new Date().toISOString(),
          is_public: false,
        })
        .eq("id", chatId);

      if (error) throw error;

      // Update local state
      setChatHistory((prevHistory) =>
        prevHistory.map((ch) =>
          ch.id === chatId
            ? {
                ...ch,
                messages,
                title,
                last_message: query,
                updated_at: new Date().toISOString(),
                is_public: false,
              }
            : ch
        )
      );
      setChatTitle(title);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const currentQuery = query;
    setQuery("");
    setLoading(true);

    try {
      const newMessage = {
        role: "user",
        content: currentQuery,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMessage]);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, newMessage],
        }),
      });

      if (!response.ok) {
        console.error("response", response);
        throw new Error("Chat request failed");
      }

      const data = await response.json();
      const assistantMessage = {
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Save to chat history if user is logged in
      if (userState) {
        if (!activeChat) {
          // Create new chat and save message
          const { data: newChat } = await supabase
            .from("chats")
            .insert([
              {
                user_id: userState.id,
                title: currentQuery.slice(0, 50),
                messages: [newMessage, assistantMessage],
                last_message: currentQuery,
                is_public: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ])
            .select()
            .single();

          if (newChat) {
            setChatHistory([newChat, ...chatHistory]);
            setActiveChat(newChat.id);
            setChatTitle(currentQuery.slice(0, 50));
          }
        } else {
          // Save to existing chat
          await saveMessage(activeChat, currentQuery, data.message);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I apologize, but I encountered an error. Please try again.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadChat = async (chatId: string) => {
    try {
      const { data: chat, error } = await supabase
        .from("chats")
        .select("*")
        .eq("id", chatId)
        .single();

      if (error) throw error;

      setActiveChat(chatId);
      setMessages(chat.messages || []);
      setChatTitle(chat.title);
    } catch (error) {
      console.error("Error loading chat:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUserState(null);
      setShowUserMenu(false);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

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
        throw new Error("Failed to load documents");
      }
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error("Error loading documents:", error);
    } finally {
      setLoadingDocs(false);
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

  const handleXShare = (chat: any, includeQuestion: boolean) => {
    const text = includeQuestion
      ? `Q: ${chat.query}\n\nA: ${chat.response}`
      : chat.response;

    const truncatedText =
      text.length > 255 ? text.substring(0, 250) + "..." : text;

    const url =
      "https://twitter.com/intent/tweet?text=" +
      encodeURIComponent(truncatedText);
    window.open(url, "_blank");
  };

  const handleLinkedInShare = (chat: any, includeQuestion: boolean) => {
    const text = includeQuestion
      ? `Q: ${chat.query}\n\nA: ${chat.response}`
      : chat.response;

    const sourceUrl = window.location.origin;

    const url = `https://www.linkedin.com/feed/?linkOrigin=LI_BADGE&shareActive=true&text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(sourceUrl)}`;
    window.open(url, "_blank");
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setShowAuthForm(false);
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Auth error:", error);
      setAuthError(
        error instanceof Error ? error.message : "Authentication failed"
      );
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      setShowAuthForm(false);
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Sign up error:", error);
      setAuthError(error instanceof Error ? error.message : "Sign up failed");
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setResetSuccess(false);

    if (!email) {
      setAuthError("Please enter your email address");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      setResetSuccess(true);
    } catch (error) {
      console.error("Password reset error:", error);
      setAuthError(
        error instanceof Error ? error.message : "Failed to send reset email"
      );
    }
  };

  const handleDocumentClick = async (doc: any) => {
    if (!doc?.id) return;

    setSelectedDocument(doc);
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/content`);
      if (!res.ok) {
        throw new Error("Failed to load document content");
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

  return (
    <main className="flex-1 flex flex-col h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-gray-900/50 backdrop-blur-sm border-b border-gray-800 z-30">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <span className="text-white font-semibold">Ragie</span>
          </div>

          <div className="flex items-center space-x-4">
            {userState ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors focus:outline-none"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                    {userState.email?.[0].toUpperCase()}
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${
                      showUserMenu ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-900 rounded-xl border border-gray-800 shadow-xl py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-800">
                      <p className="text-sm text-white font-medium truncate">
                        {userState.email}
                      </p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuthForm(true)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden pt-14">
        {/* Left Sidebar */}
        <aside
          className={`fixed left-0 top-14 bottom-0 w-80 border-r border-gray-700/50 overflow-y-auto bg-gray-900/95 transition-transform duration-200 ease-in-out ${
            showSidebar ? "translate-x-0" : "-translate-x-full"
          }`}
        >
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
                onTogglePrivacy={() => {}}
                onShowAuthForm={() => setShowAuthForm(true)}
                user={user}
              />
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className={`flex-1 flex flex-col ${showSidebar ? "ml-80" : ""}`}>
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
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span>X share with question and answer</span>
                    </button>
                    <button
                      onClick={() => handleXShare({ query, response }, false)}
                      className="text-sm px-3 py-1.5 rounded bg-gray-800/50 text-blue-400 hover:text-blue-300 hover:bg-gray-800 flex items-center gap-2 transition-colors duration-200"
                      title="Share on X without question"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span>X share with respond content only</span>
                    </button>

                    {/* LinkedIn Share Buttons */}
                    <div className="border-l border-gray-700/50 pl-2 flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleLinkedInShare({ query, response }, true)
                        }
                        className="text-sm px-3 py-1.5 rounded bg-gray-800/50 text-blue-400 hover:text-blue-300 hover:bg-gray-800 flex items-center gap-2 transition-colors duration-200"
                        title="Share on LinkedIn with question and answer"
                      >
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
                        </svg>
                        <span>LinkedIn share with Q&A</span>
                      </button>
                      <button
                        onClick={() =>
                          handleLinkedInShare({ query, response }, false)
                        }
                        className="text-sm px-3 py-1.5 rounded bg-gray-800/50 text-blue-400 hover:text-blue-300 hover:bg-gray-800 flex items-center gap-2 transition-colors duration-200"
                        title="Share on LinkedIn without question"
                      >
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
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
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAuthForm(false);
              setIsSignUp(false);
              setIsReset(false);
              setAuthError("");
              setResetSuccess(false);
            }
          }}
        >
          <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md mx-auto border border-gray-800 shadow-xl relative">
            <button
              onClick={() => {
                setShowAuthForm(false);
                setIsSignUp(false);
                setIsReset(false);
                setAuthError("");
                setResetSuccess(false);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <form
              onSubmit={
                isReset
                  ? handlePasswordReset
                  : isSignUp
                  ? handleSignUp
                  : handleAuth
              }
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-white mb-2">
                  {isReset
                    ? "Reset Password"
                    : isSignUp
                    ? "Create Account"
                    : "Welcome Back"}
                </h2>
                <p className="text-gray-400 text-sm">
                  {isReset
                    ? "Enter your email to receive reset instructions"
                    : isSignUp
                    ? "Sign up to save and share your chat history"
                    : "Sign in to access your saved chats"}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    className="block text-sm font-medium text-gray-300 mb-1.5"
                    htmlFor="email"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your email"
                  />
                </div>

                {!isReset && (
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-300 mb-1.5"
                      htmlFor="password"
                    >
                      Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                      placeholder={
                        isSignUp ? "Create a password" : "Enter your password"
                      }
                    />
                  </div>
                )}
              </div>

              {authError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl px-4 py-3">
                  <p className="text-red-400 text-sm text-center">
                    {authError}
                  </p>
                </div>
              )}

              {resetSuccess && (
                <div className="bg-green-500/10 border border-green-500/50 rounded-xl px-4 py-3">
                  <p className="text-green-400 text-sm text-center">
                    Check your email for password reset instructions
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl px-6 py-3.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                {isReset
                  ? "Send Reset Instructions"
                  : isSignUp
                  ? "Create Account"
                  : "Sign In"}
              </button>

              <div className="text-sm text-center space-y-2">
                {!isReset && (
                  <p className="text-gray-400">
                    {isSignUp
                      ? "Already have an account?"
                      : "Don't have an account?"}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setIsReset(false);
                        setAuthError("");
                        setResetSuccess(false);
                      }}
                      className="text-blue-400 hover:text-blue-300 font-medium transition-colors duration-200"
                    >
                      {isSignUp ? "Sign In" : "Sign Up"}
                    </button>
                  </p>
                )}

                {!isSignUp && (
                  <p className="text-gray-400">
                    {isReset
                      ? "Remember your password?"
                      : "Forgot your password?"}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsReset(!isReset);
                        setAuthError("");
                        setResetSuccess(false);
                      }}
                      className="text-blue-400 hover:text-blue-300 font-medium transition-colors duration-200"
                    >
                      {isReset ? "Sign In" : "Reset It"}
                    </button>
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
