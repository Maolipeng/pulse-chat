"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, PaperPlaneRight, Smiley } from "@phosphor-icons/react";

const EMOJI_SET = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "😘",
  "😎",
  "🤩",
  "🤔",
  "😅",
  "😭",
  "😡",
  "🥳",
  "😴",
  "🤯",
  "😇",
  "👍",
  "🙏",
  "👏",
  "🔥",
  "✨",
  "🎉",
  "💯",
  "❤️",
  "💬",
  "😉",
  "😌",
  "🙌",
  "🤝",
  "👌",
  "✌️",
  "🤟",
  "🤗",
  "😮",
  "😢",
  "😬",
  "🤓",
  "😺",
  "😻",
  "💡",
  "🌟",
  "🍕",
  "☕️",
  "🎧",
  "📌",
];

export default function ChatInput({
  selectedConversationId,
  messageDraft,
  onMessageDraft,
  onSend,
  onSendFile,
  onEmojiBurst,
  messageInputRef,
  fileInputRef,
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiPanelRef = useRef(null);
  const emojiRegex = useRef(
    /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D]+$/u,
  );

  useEffect(() => {
    if (!emojiOpen) return;
    const handleClickOutside = (event) => {
      if (!emojiPanelRef.current) return;
      if (!emojiPanelRef.current.contains(event.target)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiOpen]);

  const insertEmoji = (emoji) => {
    const input = messageInputRef?.current;
    if (!input) {
      onMessageDraft(`${messageDraft}${emoji}`);
      setEmojiOpen(false);
      return;
    }

    const start = input.selectionStart ?? messageDraft.length;
    const end = input.selectionEnd ?? messageDraft.length;
    const nextValue = `${messageDraft.slice(0, start)}${emoji}${messageDraft.slice(end)}`;
    onMessageDraft(nextValue);
    setEmojiOpen(false);

    requestAnimationFrame(() => {
      const cursor = start + emoji.length;
      input.focus();
      input.setSelectionRange(cursor, cursor);
    });
  };

  const maybeTriggerEmojiBurst = () => {
    const trimmed = messageDraft.trim();
    if (!trimmed) return;
    const compact = trimmed.replace(/\s+/g, "");
    if (compact.length > 12) return;
    if (!emojiRegex.current.test(compact)) return;
    onEmojiBurst?.(trimmed);
  };

  const handleSend = () => {
    maybeTriggerEmojiBurst();
    onSend();
  };

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
        <div className="relative" ref={emojiPanelRef}>
          <button
            type="button"
            onClick={() => setEmojiOpen((prev) => !prev)}
            disabled={!selectedConversationId}
            className="h-11 w-11 rounded-full border border-emerald-200 text-emerald-800 bg-white transition active:scale-95 active:bg-emerald-100 disabled:opacity-50"
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
          >
            <Smiley size={16} weight="regular" className="mx-auto" />
          </button>
          {emojiOpen && (
            <div className="absolute bottom-14 left-0 z-20 w-64 rounded-2xl border border-emerald-100 bg-white p-3 shadow-xl">
              <div className="grid grid-cols-8 gap-2">
                {EMOJI_SET.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="h-8 w-8 rounded-full text-lg hover:bg-emerald-50"
                    aria-label={`Emoji ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <input
          ref={messageInputRef}
          value={messageDraft}
          onChange={(event) => onMessageDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            selectedConversationId ? "Type a message" : "Select a conversation first"
          }
          disabled={!selectedConversationId}
          className="flex-1 rounded-full border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 disabled:bg-gray-100"
        />
        <button
          onClick={handleSend}
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
