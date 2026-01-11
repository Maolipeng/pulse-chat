"use client";

import { formatTime } from "../utils/chat-utils";

export default function MessageList({
  selectedConversationId,
  selectedMessages,
  user,
  bottomRef,
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 space-y-4 bg-white sm:bg-white/40 overscroll-y-contain">
      {!selectedConversationId && (
        <div className="h-full flex items-center justify-center text-emerald-700/70">
          Select a user to start chatting.
        </div>
      )}

      {selectedConversationId &&
        selectedMessages.map((message) => {
          const isOutgoing = message.sender?.username === user.username;
          const content = message.plaintext || message.body;
          const isFile = message.metadata?.kind === "file";
          const isImage = isFile && (message.metadata?.mime || "").startsWith("image/");

          return (
            <div
              key={message.id}
              className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  isOutgoing
                    ? "bg-[#dcf8c6] text-emerald-900"
                    : "bg-white text-emerald-900 border border-emerald-100"
                }`}
              >
                {isFile ? (
                  <div className="space-y-2">
                    {isImage && (
                      <a
                        href={content}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-xl border border-emerald-100"
                      >
                        <img
                          src={content}
                          alt={message.metadata?.name || "image"}
                          className="h-40 w-full object-cover"
                        />
                      </a>
                    )}
                    <a
                      href={content}
                      download={message.metadata?.name || "file"}
                      className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-white/80 px-3 py-2 text-sm text-emerald-800 hover:border-emerald-300"
                    >
                      <span aria-hidden="true">📎</span>
                      <span className="min-w-0 flex-1 truncate">
                        {message.metadata?.name || "Download file"}
                      </span>
                    </a>
                  </div>
                ) : (
                  <p className="leading-relaxed">{content}</p>
                )}
                <div className="mt-2 text-[11px] flex items-center gap-2 text-emerald-700">
                  <span>{formatTime(message.createdAt)}</span>
                  {!isOutgoing && message.sender?.username && (
                    <span>{message.sender.username}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      <div ref={bottomRef} />
    </div>
  );
}
