import React from 'react';
import { ShareButtons } from './ShareButtons';

interface ChatHistoryProps {
  history: any[];
  onChatSelect: (query: string, response: string) => void;
  onShare: (chat: any, includeQuestion: boolean) => void;
  onXShare: (chat: any, includeQuestion: boolean) => void;
  onTogglePrivacy: (id: string, isPublic: boolean) => void;
  onShowAuthForm: () => void;
  user: any;
}

export function ChatHistory({
  history,
  onChatSelect,
  onShare,
  onXShare,
  onTogglePrivacy,
  onShowAuthForm,
  user,
}: ChatHistoryProps) {
  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 mb-2">Sign in to view chat history</p>
        <button
          onClick={onShowAuthForm}
          className="text-blue-400 hover:text-blue-300 transition-colors duration-200"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">No chat history</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((chat, index) => (
        <button
          key={chat.id || index}
          onClick={() => onChatSelect(chat.query, chat.response)}
          className="w-full text-left p-3 rounded-lg transition-colors duration-200 border border-transparent hover:bg-gray-800/50 hover:text-white text-gray-400 group"
        >
          <div className="font-medium truncate">{chat.query}</div>
          <div className="text-sm text-gray-500 truncate mt-1">
            {new Date(chat.created_at).toLocaleString()}
          </div>
          <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <ShareButtons
              chat={chat}
              onShare={onShare}
              onXShare={onXShare}
              onTogglePrivacy={onTogglePrivacy}
            />
          </div>
        </button>
      ))}
    </div>
  );
}
