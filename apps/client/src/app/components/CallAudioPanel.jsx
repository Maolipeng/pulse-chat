"use client";

import { ArrowLeft, Microphone, MicrophoneSlash, PhoneDisconnect } from "@phosphor-icons/react";
import { getAvatarColor, getInitials } from "../utils/chat-utils";

export default function CallAudioPanel({
  callState,
  callPeer,
  localMicOn,
  onBack,
  onToggleMic,
  onEndCall,
  hideChatPanel,
}) {
  if (callState === "idle") return null;

  return (
    <>
      <div className="sm:hidden fixed inset-0 z-30 bg-[#4b4a52] text-white flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 rounded-full bg-white/10 text-white transition active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft size={16} weight="regular" className="mx-auto" />
          </button>
          <div className="text-center">
            <div className="text-lg font-semibold">{callPeer || "Unknown"}</div>
            <div className="text-xs text-white/70">
              {callState === "calling" && "Calling..."}
              {callState === "connecting" && "Connecting..."}
              {callState === "in-call" && "Connected"}
            </div>
          </div>
          <div className="h-10 w-10" />
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div
            className="h-24 w-24 rounded-full flex items-center justify-center text-2xl font-semibold text-emerald-900 bg-white"
            style={{ backgroundColor: getAvatarColor(callPeer) }}
          >
            {getInitials(callPeer)}
          </div>
        </div>

        <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))] px-6">
          <div className="mx-auto w-full max-w-xs rounded-full bg-black/40 px-6 py-3 flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={onToggleMic}
              className={`h-12 w-12 rounded-full flex items-center justify-center transition active:scale-95 ${
                localMicOn ? "bg-white/15 text-white" : "bg-white text-emerald-900"
              }`}
              aria-label={localMicOn ? "Mute microphone" : "Unmute microphone"}
            >
              {localMicOn ? (
                <Microphone size={20} weight="regular" />
              ) : (
                <MicrophoneSlash size={20} weight="regular" />
              )}
            </button>
            <button
              type="button"
              onClick={onEndCall}
              className="h-12 w-12 rounded-full bg-red-500 text-white shadow-lg flex items-center justify-center transition active:scale-95 active:bg-red-600"
              aria-label="Hang up"
            >
              <PhoneDisconnect size={20} weight="regular" />
            </button>
          </div>
        </div>
      </div>

      <div className={`hidden sm:block px-5 sm:px-6 pb-4 pt-4 ${hideChatPanel ? "flex-1 flex items-center" : ""}`}>
        <div className="rounded-3xl border border-emerald-100 bg-white/90 px-4 py-5 shadow-sm w-full">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">
                Voice call
              </p>
              <h4 className="mt-2 text-lg font-semibold text-emerald-950">
                {callPeer || "Unknown"}
              </h4>
            </div>
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center text-base font-semibold text-emerald-900"
              style={{ backgroundColor: getAvatarColor(callPeer) }}
            >
              {getInitials(callPeer)}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onEndCall}
              className="h-11 w-11 rounded-full bg-red-500 text-white shadow-lg transition active:scale-95 active:bg-red-600"
              aria-label="Hang up"
            >
              <PhoneDisconnect size={20} weight="regular" />
            </button>
            <span className="text-xs text-emerald-700">
              {callState === "calling" && "Calling..."}
              {callState === "connecting" && "Connecting..."}
              {callState === "in-call" && "Connected"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
