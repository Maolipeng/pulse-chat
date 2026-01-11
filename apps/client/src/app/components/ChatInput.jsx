"use client";

import { Paperclip, PaperPlaneRight } from "@phosphor-icons/react";

export default function ChatInput({
  selectedConversationId,
  messageDraft,
  onMessageDraft,
  onSend,
  onSendFile,
  messageInputRef,
  fileInputRef,
}) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-white/70 bg-white/95 backdrop-blur px-4 py-3 sm:px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(event) => onSendFile(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!selectedConversationId}
          className="h-11 w-11 rounded-full border border-emerald-200 text-emerald-800 bg-white transition active:scale-95 active:bg-emerald-100 disabled:opacity-50"
          aria-label="Send file"
        >
          <Paperclip size={16} weight="regular" className="mx-auto" />
        </button>
        <input
          ref={messageInputRef}
          value={messageDraft}
          onChange={(event) => onMessageDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={
            selectedConversationId ? "Type a message" : "Select a conversation first"
          }
          disabled={!selectedConversationId}
          className="flex-1 rounded-full border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 disabled:bg-gray-100"
        />
        <button
          onClick={onSend}
          disabled={!selectedConversationId}
          className="h-11 w-11 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:bg-emerald-300 transition active:scale-95 active:bg-emerald-700"
          aria-label="Send message"
        >
          <PaperPlaneRight size={16} weight="regular" />
        </button>
      </div>
      <div className="mt-2 text-xs text-emerald-600">
        Enter to send, Shift + Enter for new line.
      </div>
    </div>
  );
}
