"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { parseUserList } from "../utils/chat-utils";
import useAuth from "../hooks/useAuth";
import useSocketSession from "../hooks/useSocketSession";
import useMessaging from "../hooks/useMessaging";
import useConversations from "../hooks/useConversations";
import useCallSession from "../hooks/useCallSession";
import ChatSidebar from "./ChatSidebar";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import SettingsModal from "./SettingsModal";
import ComposerModal from "./ComposerModal";
import IncomingCallModal from "./IncomingCallModal";
import CallAudioPanel from "./CallAudioPanel";
import CallVideoPanel from "./CallVideoPanel";

export default function ChatApp({ initialTab = "chat" }) {
  const router = useRouter();
  const [mobileTab, setMobileTab] = useState(initialTab);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState("chat");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const bottomRef = useRef(null);
  const searchRef = useRef(null);
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const {
    apiFetch,
    authChecked,
    token,
    user,
    handleLogout,
  } = useAuth();

  const { socket, socketRef, connectionStatus, usersOnline } = useSocketSession({ token });
  const messaging = useMessaging({ apiFetch, user, onNotice: setNotice });

  const conversations = useConversations({
    apiFetch,
    socket,
    user,
    notificationsEnabled,
    onNotice: setNotice,
    encryptMessage: messaging.encryptMessage,
    decryptMessage: messaging.decryptMessage,
    ensureConversationKey: messaging.ensureConversationKey,
    distributeGroupKey: messaging.distributeGroupKey,
    fileToDataUrl: messaging.fileToDataUrl,
    messageInputRef,
    bottomRef,
  });

  const callSession = useCallSession({ socket, user });

  useEffect(() => {
    setMobileTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  useEffect(() => {
    if (connectionStatus === "offline") {
      callSession.resetCallState();
    }
  }, [callSession.resetCallState, connectionStatus]);

  useEffect(() => {
    const setAppHeight = () => {
      if (typeof window === "undefined") return;
      const height = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${height}px`);
    };

    setAppHeight();
    window.visualViewport?.addEventListener("resize", setAppHeight);
    window.visualViewport?.addEventListener("scroll", setAppHeight);
    window.addEventListener("resize", setAppHeight);

    return () => {
      window.visualViewport?.removeEventListener("resize", setAppHeight);
      window.visualViewport?.removeEventListener("scroll", setAppHeight);
      window.removeEventListener("resize", setAppHeight);
    };
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setComposerMode("chat");
        setComposerOpen(true);
      }
      if (event.key === "Escape") {
        setComposerOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!token || !user) {
      router.replace("/login");
    }
  }, [authChecked, router, token, user]);

  useEffect(() => {
    if (callSession.callState !== "idle") return;
    callSession.setCallPeer(conversations.callTarget || "");
  }, [callSession.callState, callSession.setCallPeer, conversations.callTarget]);

  const handleNotifications = async () => {
    if (!("Notification" in window)) {
      setNotice("Notifications not supported in this browser.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
  };

  const handleLogoutClick = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    callSession.resetCallState();
    handleLogout();
  };

  const filteredCallHistory = useMemo(() => {
    const entries = Array.isArray(callSession.callHistory)
      ? callSession.callHistory
      : [];
    if (!conversations.search) return entries;
    const term = conversations.search.toLowerCase();
    return entries.filter((entry) =>
      (entry.peer || "").toLowerCase().includes(term),
    );
  }, [callSession.callHistory, conversations.search]);

  const handleDropFiles = (event) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    conversations.handleSendFile(file);
  };

  if (!authChecked) {
    return (
      <div className="min-h-[var(--app-height,100svh)] flex items-center justify-center px-4 py-6 sm:p-6">
        <div className="w-full max-w-md bg-white/85 border border-white/60 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">
            PulseChat
          </p>
          <p className="mt-4 text-sm text-emerald-800">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return null;
  }

  return (
    <div
      className="min-h-[var(--app-height,100svh)] flex items-stretch sm:items-center justify-center px-0 py-0 sm:px-4 sm:py-6 [padding-bottom:env(safe-area-inset-bottom)]"
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDropFiles}
    >
      <audio ref={callSession.audioRef} autoPlay playsInline />
      <div className="w-full h-[var(--app-height,100svh)] sm:h-[92svh] md:h-[84vh] max-w-6xl bg-white/80 border border-white/70 sm:rounded-3xl shadow-2xl backdrop-blur overflow-hidden pb-[env(safe-area-inset-bottom)] relative">
        {dragActive && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-emerald-900/20 backdrop-blur">
            <div className="rounded-2xl border border-emerald-200 bg-white/90 px-6 py-4 text-sm text-emerald-900">
              Drop a file to send
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-full">
          <ChatSidebar
            className={conversations.selectedConversationId ? "hidden md:block" : "block"}
            user={user}
            connectionStatus={connectionStatus}
            search={conversations.search}
            onSearch={conversations.setSearch}
            searchRef={searchRef}
            filteredConversations={conversations.filteredConversations}
            selectedConversationId={conversations.selectedConversationId}
            onSelectConversation={(conversation) => {
              conversations.handleSelectConversation(conversation);
              setMobileTab("chat");
              router.push("/chats");
            }}
            notificationsEnabled={notificationsEnabled}
            onNotifications={handleNotifications}
            onLogout={handleLogoutClick}
            onResetEncryption={messaging.handleResetEncryption}
            setComposerMode={setComposerMode}
            setComposerOpen={setComposerOpen}
            setSettingsOpen={setSettingsOpen}
            mobileTab={mobileTab}
            onTabChange={(tab) => {
              setMobileTab(tab);
              if (tab === "calls") {
                conversations.setSelectedConversationId("");
                router.push("/calls");
              } else {
                router.push("/chats");
              }
            }}
            filteredCallHistory={filteredCallHistory}
            callState={callSession.callState}
            onStartDirectCall={callSession.startDirectCall}
            onClearSelection={() => conversations.setSelectedConversationId("")}
          />

          <main
            className={`h-full min-h-0 flex flex-col ${
              conversations.selectedConversationId ? "flex" : "hidden md:flex"
            }`}
          >
            <ChatHeader
              selectedConversation={conversations.selectedConversation}
              otherMembers={conversations.otherMembers}
              usersOnline={usersOnline}
              isGroup={conversations.isGroup}
              callTarget={conversations.callTarget}
              callState={callSession.callState}
              connectionStatus={connectionStatus}
              onBack={() => conversations.setSelectedConversationId("")}
              onStartAudio={() => callSession.startCall("audio")}
              onStartVideo={() => callSession.startCall("video")}
            />

            {notice && (
              <div className="px-5 py-3 sm:px-6 text-xs text-emerald-800 bg-emerald-100 border-b border-emerald-200">
                {notice}
              </div>
            )}

            {callSession.callNotice && (
              <div className="px-5 py-3 sm:px-6 text-xs text-emerald-800 bg-emerald-100 border-b border-emerald-200">
                {callSession.callNotice}
              </div>
            )}

            {callSession.callState === "calling" && (
              <div className="px-5 py-3 sm:px-6 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
                <span>
                  Calling {callSession.callPeer} ({callSession.callType})...
                </span>
                <button
                  type="button"
                  onClick={callSession.cancelCall}
                  className="h-9 w-9 rounded-full border border-emerald-200 text-emerald-800 bg-white transition active:scale-95 active:bg-emerald-100"
                  aria-label="Cancel call"
                >
                  <X size={16} weight="regular" className="mx-auto" />
                </button>
              </div>
            )}

            {callSession.callState === "connecting" && (
              <div className="px-5 py-3 sm:px-6 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
                <span>
                  Connecting to {callSession.callPeer} ({callSession.callType})...
                </span>
              </div>
            )}

            {callSession.callState === "in-call" && (
              <div className="px-5 py-3 sm:px-6 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
                <span>
                  In {callSession.callType} call with {callSession.callPeer}
                </span>
              </div>
            )}

            {callSession.needsAudioUnlock &&
              callSession.callState !== "idle" && (
                <div className="px-5 py-3 sm:px-6 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
                  <span>Audio is muted by the browser.</span>
                  <button
                    type="button"
                    onClick={callSession.unlockAudio}
                    className="text-xs px-3 py-1 rounded-full border border-emerald-200 text-emerald-800 bg-white transition active:scale-95 active:bg-emerald-100"
                  >
                    Enable audio
                  </button>
                </div>
              )}

            {callSession.callType === "audio" &&
              callSession.callState !== "idle" && (
                <CallAudioPanel
                  callState={callSession.callState}
                  callPeer={callSession.callPeer}
                  localMicOn={callSession.localMicOn}
                  onBack={() => conversations.setSelectedConversationId("")}
                  onToggleMic={callSession.toggleMic}
                  onEndCall={callSession.endCall}
                  hideChatPanel={callSession.hideChatPanel}
                />
              )}

            <CallVideoPanel
              showVideoPanel={callSession.showVideoPanel}
              videoFullscreen={callSession.videoFullscreen}
              mainVideoIsRemote={callSession.mainVideoIsRemote}
              callPeer={callSession.callPeer}
              localLabel={user?.username}
              callState={callSession.callState}
              callType={callSession.callType}
              localVideoOn={callSession.localVideoOn}
              remoteVideoOn={callSession.remoteVideoOn}
              localMicOn={callSession.localMicOn}
              canFlipCamera={callSession.canFlipCamera}
              localStream={callSession.localStream}
              remoteStream={callSession.remoteStream}
              localVideoRef={callSession.localVideoRef}
              remoteVideoRef={callSession.remoteVideoRef}
              onToggleVideoFocus={callSession.toggleVideoFocus}
              onToggleVideoFullscreen={callSession.toggleVideoFullscreen}
              onToggleCamera={callSession.toggleCamera}
              onEnableCamera={callSession.enableCamera}
              onFlipCamera={callSession.switchCamera}
              onToggleMic={callSession.toggleMic}
              onEndCall={callSession.endCall}
              onBack={() => conversations.setSelectedConversationId("")}
            />

            {!callSession.hideChatPanel && (
              <>
                <MessageList
                  selectedConversationId={conversations.selectedConversationId}
                  selectedMessages={conversations.selectedMessages}
                  user={user}
                  bottomRef={bottomRef}
                />

                <ChatInput
                  selectedConversationId={conversations.selectedConversationId}
                  messageDraft={conversations.messageDraft}
                  onMessageDraft={conversations.setMessageDraft}
                  onSend={conversations.handleSend}
                  onSendFile={conversations.handleSendFile}
                  messageInputRef={messageInputRef}
                  fileInputRef={fileInputRef}
                />
              </>
            )}
          </main>
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        user={user}
        notificationsEnabled={notificationsEnabled}
        onClose={() => setSettingsOpen(false)}
        onNotifications={handleNotifications}
        onResetEncryption={messaging.handleResetEncryption}
        onSignOut={handleLogoutClick}
      />

      <ComposerModal
        open={composerOpen}
        mode={composerMode}
        onClose={() => setComposerOpen(false)}
        userSearch={conversations.userSearch}
        onUserSearch={conversations.setUserSearch}
        userResults={conversations.userResults}
        onQuickChat={conversations.handleQuickChat}
        composerTitle={conversations.composerTitle}
        onComposerTitle={conversations.setComposerTitle}
        composerMembers={conversations.composerMembers}
        onComposerMembers={conversations.setComposerMembers}
        onCreateGroup={() =>
          conversations.handleCreateConversation(
            parseUserList(conversations.composerMembers),
            conversations.composerTitle,
          )
        }
      />

      {callSession.callState === "ringing" && (
        <IncomingCallModal
          offer={callSession.incomingOffer}
          onAccept={callSession.acceptCall}
          onReject={callSession.rejectCall}
        />
      )}
    </div>
  );
}
