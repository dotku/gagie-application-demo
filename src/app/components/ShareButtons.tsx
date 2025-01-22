import React from 'react';

interface ShareButtonsProps {
  chat: {
    query: string;
    response: string;
    id: string;
    is_public: boolean;
  };
  onShare: (chat: any, includeQuestion: boolean) => void;
  onXShare: (chat: any, includeQuestion: boolean) => void;
  onTogglePrivacy: (id: string, isPublic: boolean) => void;
}

export function ShareButtons({ chat, onShare, onXShare, onTogglePrivacy }: ShareButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Privacy Toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePrivacy(chat.id, chat.is_public);
        }}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        {chat.is_public ? 'Make Private' : 'Make Public'}
      </button>

      {/* Share Links */}
      <div className="flex items-center gap-2 ml-2 border-l border-gray-700/50 pl-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare(chat, true);
          }}
          className="text-xs px-2 py-1 rounded bg-gray-800/50 text-blue-400 hover:text-blue-300 hover:bg-gray-800 flex items-center gap-1 transition-colors duration-200"
          title="Share with question"
        >
          <ShareIcon />
          <span>Share Link</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare(chat, false);
          }}
          className="text-xs px-2 py-1 rounded bg-gray-800/50 text-blue-400 hover:text-blue-300 hover:bg-gray-800 flex items-center gap-1 transition-colors duration-200"
          title="Share answer only"
        >
          <ShareIcon />
          <span>Share Content</span>
        </button>
      </div>

      {/* X Share Buttons */}
      <div className="border-l border-gray-700/50 pl-2 flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onXShare(chat, true);
          }}
          className="text-xs px-2 py-1 rounded bg-gray-800/50 text-blue-400 hover:text-blue-300 hover:bg-gray-800 flex items-center gap-1 transition-colors duration-200"
          title="Share on X with question and answer"
        >
          <XIcon />
          <span>X share with question and answer</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onXShare(chat, false);
          }}
          className="text-xs px-2 py-1 rounded bg-gray-800/50 text-blue-400 hover:text-blue-300 hover:bg-gray-800 flex items-center gap-1 transition-colors duration-200"
          title="Share on X without question"
        >
          <XIcon />
          <span>X share with respond content only</span>
        </button>
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
