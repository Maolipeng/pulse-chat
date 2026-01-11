"use client";

import {
  Camera,
  ChatCenteredDots,
  MagnifyingGlass,
  PencilSimple,
  Phone,
  Sparkle,
} from "@phosphor-icons/react";
import { formatTime, getAvatarColor, getInitials } from "../utils/chat-utils";

export default function ChatSidebar({
  className = "",
  user,
  connectionStatus,
  search,
  onSearch,
  searchRef,
  filteredConversations,
  selectedConversationId,
  onSelectConversation,
  notificationsEnabled,
  onNotifications,
  onLogout,
  onResetEncryption,
  setComposerMode,
  setComposerOpen,
  setSettingsOpen,
  mobileTab,
  onTabChange,
  filteredCallHistory,
  callState,
  onStartDirectCall,
  onClearSelection,
}) {
  return (
    <aside
      className={`relative h-full border-r border-white/70 bg-gradient-to-b from-emerald-100/70 via-white/70 to-orange-100/70 p-5 sm:p-6 pb-24 sm:pb-6 ${className}`}
    >
      <div className="sm:hidden flex items-center justify-between">
        <button
          type="button"
          className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold text-emerald-900 border border-white/70 bg-white/90 shadow-sm"
          style={{ backgroundColor: getAvatarColor(user.username) }}
          aria-label="Profile"
          onClick={() => setSettingsOpen(true)}
        >
          {getInitials(user.username)}
        </button>
        <div className="text-base font-semibold text-emerald-950">
          {mobileTab === "calls" ? "通话" : "聊天"}
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 shadow-sm border border-white/80">
          <button
            type="button"
            onClick={() => {
              setComposerMode("chat");
              setComposerOpen(true);
            }}
            className="h-8 w-8 rounded-full text-emerald-800 transition active:scale-95 active:bg-emerald-100"
            aria-label="New chat"
          >
            <Camera size={16} weight="regular" className="mx-auto" />
          </button>
          <button
            type="button"
            onClick={() => {
              setComposerMode("group");
              setComposerOpen(true);
            }}
            className="h-8 w-8 rounded-full text-emerald-800 transition active:scale-95 active:bg-emerald-100"
            aria-label="New group"
          >
            <PencilSimple size={16} weight="regular" className="mx-auto" />
          </button>
        </div>
      </div>

      <div className="hidden sm:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold text-emerald-900"
            style={{ backgroundColor: getAvatarColor(user.username) }}
          >
            {getInitials(user.username)}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">
              Online
            </p>
            <h2 className="text-xl font-semibold text-emerald-950 mt-1">
              {user.username}
            </h2>
          </div>
        </div>
        <span
          className={`text-xs px-3 py-1 rounded-full border ${
            connectionStatus === "online"
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-amber-200 text-amber-900 border-amber-300"
          }`}
        >
          {connectionStatus === "online" ? "connected" : "offline"}
        </span>
      </div>

      <div className="mt-5 hidden sm:flex gap-2">
        <button
          type="button"
          onClick={() => {
            setComposerMode("chat");
            setComposerOpen(true);
          }}
          className="text-xs px-3 py-2 rounded-2xl border border-emerald-200 text-emerald-800 bg-white transition active:scale-95 active:bg-emerald-100"
        >
          New chat
        </button>
        <button
          type="button"
          onClick={() => {
            setComposerMode("group");
            setComposerOpen(true);
          }}
          className="text-xs px-3 py-2 rounded-2xl border border-emerald-200 text-emerald-800 bg-white transition active:scale-95 active:bg-emerald-100"
        >
          New group
        </button>
      </div>

      <div className="mt-4">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400">
            <MagnifyingGlass size={16} weight="regular" />
          </span>
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={mobileTab === "calls" ? "搜索通话" : "搜索"}
            className="w-full rounded-full border border-emerald-100 bg-emerald-50/80 px-11 py-3 text-sm outline-none focus:border-emerald-400"
          />
          <span className="absolute right-4 top-3.5 hidden sm:block text-xs text-emerald-500">
            Ctrl/Cmd + K
          </span>
        </div>
      </div>

      <div className="mt-5">
        <label className="text-xs uppercase tracking-[0.3em] text-emerald-700 hidden sm:block">
          {mobileTab === "calls" ? "Calls" : "Conversations"}
        </label>
        <div className="mt-3 space-y-2">
          {mobileTab === "calls" ? (
            <>
              {filteredCallHistory.length === 0 && (
                <div className="text-sm text-emerald-700/70 bg-white/70 rounded-2xl p-4 border border-white/70">
                  No calls yet. Start a voice call.
                </div>
              )}
              {filteredCallHistory.map((entry) => (
                <button
                  key={entry.id || `${entry.peer}-${entry.at}`}
                  onClick={() => onStartDirectCall(entry.peer, "audio")}
                  disabled={callState !== "idle" || connectionStatus !== "online"}
                  className="w-full text-left transition border-b border-emerald-100/70 px-2 py-3 sm:border-none sm:rounded-2xl sm:px-4 sm:py-3 bg-white/80 text-emerald-950 hover:bg-white disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold"
                      style={{ backgroundColor: getAvatarColor(entry.peer || "Call") }}
                    >
                      {getInitials(entry.peer || "Call")}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-base">{entry.peer}</span>
                        <span className="text-xs opacity-70">
                          {formatTime(entry.at)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-sm text-emerald-700/70">
                          {entry.type === "video" ? "视频通话" : "语音通话"}
                        </p>
                        <span className="h-8 w-8 rounded-full border border-emerald-200 text-emerald-800 bg-white flex items-center justify-center">
                          <Phone size={14} weight="regular" />
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </>
          ) : (
            <>
              {filteredConversations.length === 0 && (
                <div className="text-sm text-emerald-700/70 bg-white/70 rounded-2xl p-4 border border-white/70">
                  No conversations yet. Start a new chat.
                </div>
              )}
              {filteredConversations.map((conversation) => {
                const isActive = conversation.id === selectedConversationId;
                const conversationName = conversation.isGroup
                  ? conversation.title
                  : conversation.members
                      .filter((member) => member.username !== user.username)
                      .map((member) => member.username)
                      .join(", ");

                return (
                  <button
                    key={conversation.id}
                    onClick={() => onSelectConversation(conversation)}
                    className={`w-full text-left transition border-b border-emerald-100/70 px-2 py-3 sm:border-none sm:rounded-2xl sm:px-4 sm:py-3 ${
                      isActive
                        ? "bg-white text-emerald-950 sm:bg-emerald-600 sm:text-white"
                        : "bg-white/80 text-emerald-950 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold"
                        style={{
                          backgroundColor: getAvatarColor(conversationName || "Chat"),
                        }}
                      >
                        {getInitials(conversationName || "Chat")}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-base">
                            {conversationName || "Untitled"}
                          </span>
                          {conversation.lastMessage && (
                            <span className="text-xs opacity-70">
                              {formatTime(conversation.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <p
                            className={`text-sm truncate ${
                              isActive
                                ? "text-emerald-700/80 sm:text-white/80"
                                : "text-emerald-700/70"
                            }`}
                          >
                            {conversation.preview || "Start a new chat"}
                          </p>
                          {conversation.unread > 0 && (
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full ${
                                isActive
                                  ? "bg-emerald-600 text-white sm:bg-white sm:text-emerald-600"
                                  : "bg-emerald-600 text-white"
                              }`}
                            >
                              {conversation.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onNotifications}
        className={`mt-4 w-full rounded-2xl border border-emerald-200 text-emerald-800 bg-white px-4 py-3 text-xs font-semibold transition active:scale-95 active:bg-emerald-100 ${
          mobileTab !== "chat" ? "hidden sm:block" : ""
        }`}
      >
        {notificationsEnabled ? "Notifications enabled" : "Enable notifications"}
      </button>

      <button
        type="button"
        onClick={onLogout}
        className={`mt-6 text-xs text-emerald-700 transition active:scale-95 ${
          mobileTab !== "chat" ? "hidden sm:block" : ""
        }`}
      >
        Sign out
      </button>
      <div
        className={`mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 ${
          mobileTab !== "chat" ? "hidden sm:block" : ""
        }`}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-amber-700">
          Security
        </p>
        <p className="mt-2 text-xs text-amber-800">
          If messages fail to decrypt, reset the local encryption cache.
        </p>
        <button
          type="button"
          onClick={onResetEncryption}
          className="mt-3 w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition active:scale-[0.98] active:bg-amber-100"
        >
          Reset encryption state
        </button>
      </div>

      <div className="sm:hidden fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-8 rounded-full bg-white/95 px-8 py-3 shadow-xl border border-white/70">
          <button
            className={`flex flex-col items-center text-[11px] ${
              mobileTab === "chat" ? "text-emerald-900" : "text-emerald-500/70"
            }`}
            onClick={() => onTabChange("chat")}
          >
            <span
              className={`h-9 w-9 rounded-full flex items-center justify-center ${
                mobileTab === "chat" ? "bg-emerald-100" : "bg-emerald-50"
              }`}
            >
              <ChatCenteredDots size={16} weight="regular" />
            </span>
            聊天
          </button>
          <button
            className={`flex flex-col items-center text-[11px] ${
              mobileTab === "calls" ? "text-emerald-900" : "text-emerald-500/70"
            }`}
            onClick={() => {
              onClearSelection();
              onTabChange("calls");
            }}
          >
            <span
              className={`h-9 w-9 rounded-full flex items-center justify-center ${
                mobileTab === "calls" ? "bg-emerald-100" : "bg-emerald-50"
              }`}
            >
              <Phone size={16} weight="regular" />
            </span>
            通话
          </button>
          <button className="flex flex-col items-center text-[11px] text-emerald-500/70">
            <span className="h-9 w-9 rounded-full bg-emerald-50 flex items-center justify-center">
              <Sparkle size={16} weight="regular" />
            </span>
            动态
          </button>
        </div>
      </div>
    </aside>
  );
}
