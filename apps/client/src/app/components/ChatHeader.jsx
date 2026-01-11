"use client";

import {
  ArrowLeft,
  Phone,
  VideoCamera,
} from "@phosphor-icons/react";
import { getAvatarColor, getInitials } from "../utils/chat-utils";

export default function ChatHeader({
  selectedConversation,
  otherMembers,
  usersOnline,
  isGroup,
  callTarget,
  callState,
  connectionStatus,
  onBack,
  onStartAudio,
  onStartVideo,
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-white/70 px-5 py-4 sm:px-6 bg-white/90 backdrop-blur">
      <div className="sm:hidden flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="h-10 w-10 rounded-full bg-white/90 border border-white/80 text-emerald-800 transition active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={16} weight="regular" className="mx-auto" />
        </button>
        <div className="flex items-center gap-2">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold text-emerald-900"
            style={{ backgroundColor: getAvatarColor(callTarget || "Chat") }}
          >
            {getInitials(
              selectedConversation
                ? selectedConversation.isGroup
                  ? selectedConversation.title
                  : otherMembers.map((member) => member.username).join(", ")
                : "Chat",
            )}
          </div>
          <span className="text-sm font-semibold text-emerald-950">
            {selectedConversation
              ? selectedConversation.isGroup
                ? selectedConversation.title
                : otherMembers.map((member) => member.username).join(", ")
              : "聊天"}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/90 border border-white/80 px-2 py-1">
          {!isGroup && callTarget && (
            <>
              <button
                type="button"
                onClick={onStartVideo}
                disabled={callState !== "idle" || connectionStatus !== "online"}
                className="h-8 w-8 rounded-full text-emerald-800 transition active:scale-95 active:bg-emerald-100 disabled:opacity-50"
                aria-label="Start video call"
              >
                <VideoCamera size={16} weight="regular" className="mx-auto" />
              </button>
              <button
                type="button"
                onClick={onStartAudio}
                disabled={callState !== "idle" || connectionStatus !== "online"}
                className="h-8 w-8 rounded-full text-emerald-800 transition active:scale-95 active:bg-emerald-100 disabled:opacity-50"
                aria-label="Start voice call"
              >
                <Phone size={16} weight="regular" className="mx-auto" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="hidden sm:flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">
            Chat
          </p>
          <h3 className="text-xl font-semibold text-emerald-950 mt-1">
            {selectedConversation
              ? selectedConversation.isGroup
                ? selectedConversation.title
                : otherMembers.map((member) => member.username).join(", ")
              : "Pick a conversation"}
          </h3>
          {selectedConversation && (
            <p className="text-xs text-emerald-700 mt-1">
              {selectedConversation.isGroup
                ? `${selectedConversation.members.length} members`
                : otherMembers
                    .map((member) =>
                      usersOnline.some(
                        (onlineUser) => onlineUser.username === member.username,
                      )
                        ? "online"
                        : "offline",
                    )
                    .join(", ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isGroup && callTarget && (
            <>
              <button
                type="button"
                onClick={onStartAudio}
                disabled={callState !== "idle" || connectionStatus !== "online"}
                className="h-9 w-9 rounded-full border border-emerald-200 text-emerald-800 bg-white disabled:opacity-50 transition active:scale-95 active:bg-emerald-50"
                aria-label="Start voice call"
              >
                <Phone size={16} weight="regular" className="mx-auto" />
              </button>
              <button
                type="button"
                onClick={onStartVideo}
                disabled={callState !== "idle" || connectionStatus !== "online"}
                className="h-9 w-9 rounded-full border border-emerald-200 text-emerald-800 bg-white disabled:opacity-50 transition active:scale-95 active:bg-emerald-50"
                aria-label="Start video call"
              >
                <VideoCamera size={16} weight="regular" className="mx-auto" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
