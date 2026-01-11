"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowsIn,
  ArrowsOut,
  CameraRotate,
  Microphone,
  MicrophoneSlash,
  PhoneDisconnect,
  VideoCamera,
  VideoCameraSlash,
} from "@phosphor-icons/react";
import { getInitials } from "../utils/chat-utils";

export default function CallVideoPanel({
  showVideoPanel,
  videoFullscreen,
  mainVideoIsRemote,
  callPeer,
  localLabel,
  callState,
  callType,
  localVideoOn,
  remoteVideoOn,
  localMicOn,
  canFlipCamera,
  localStream,
  remoteStream,
  localVideoRef,
  remoteVideoRef,
  onToggleVideoFocus,
  onToggleVideoFullscreen,
  onToggleCamera,
  onEnableCamera,
  onFlipCamera,
  onToggleMic,
  onEndCall,
  onBack,
}) {
  if (!showVideoPanel) return null;

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 640px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 640px)");
    const handler = (event) => setIsMobile(event.matches);
    if (media.addEventListener) {
      media.addEventListener("change", handler);
    } else {
      media.addListener(handler);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handler);
      } else {
        media.removeListener(handler);
      }
    };
  }, []);

  useEffect(() => {
    if (!localVideoRef?.current || !localStream) return;
    localVideoRef.current.srcObject = localStream;
    localVideoRef.current.muted = true;
    localVideoRef.current.play().catch(() => undefined);
  }, [localStream, localVideoRef]);

  useEffect(() => {
    if (!remoteVideoRef?.current || !remoteStream) return;
    remoteVideoRef.current.srcObject = remoteStream;
    remoteVideoRef.current.muted = true;
    remoteVideoRef.current.play().catch(() => undefined);
  }, [remoteStream, remoteVideoRef]);

  return (
    <>
      {isMobile ? (
        <div className="fixed inset-0 z-30 bg-black">
          <div
            className="absolute inset-0 overflow-hidden"
            onClick={onToggleVideoFocus}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter") onToggleVideoFocus();
            }}
          >
            <video
              ref={mainVideoIsRemote ? remoteVideoRef : localVideoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={(event) => {
                event.currentTarget.play().catch(() => undefined);
              }}
              className="h-full w-full object-cover"
            />
            {!remoteVideoOn && mainVideoIsRemote && (
              <div className="absolute inset-0 flex items-center justify-center text-3xl font-semibold text-white">
                {getInitials(callPeer)}
              </div>
            )}
            {!localVideoOn && !mainVideoIsRemote && (
              <div className="absolute inset-0 flex items-center justify-center text-3xl font-semibold text-white">
                {getInitials(localLabel || "You")}
              </div>
            )}
          </div>

          <div
            className={`absolute top-0 left-0 right-0 px-4 pt-4 transition ${
              videoFullscreen ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <div className="flex items-center justify-between text-white">
              <button
                type="button"
                onClick={onBack}
                className="h-10 w-10 rounded-full bg-black/40 transition active:scale-95"
                aria-label="Back"
              >
                <ArrowLeft size={16} weight="regular" className="mx-auto" />
              </button>
              <div className="text-center">
                <div className="text-base font-semibold">{callPeer || "Remote"}</div>
                <div className="text-xs text-white/70">
                  {callState === "calling" && "Calling..."}
                  {callState === "connecting" && "Connecting..."}
                  {callState === "in-call" && "Connected"}
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleVideoFullscreen}
                className="h-10 w-10 rounded-full bg-black/40 transition active:scale-95"
                aria-label={videoFullscreen ? "Exit full screen" : "Full screen"}
              >
                {videoFullscreen ? (
                  <ArrowsIn size={16} weight="regular" className="mx-auto" />
                ) : (
                  <ArrowsOut size={16} weight="regular" className="mx-auto" />
                )}
              </button>
            </div>
          </div>

          <div
            className={`absolute top-20 right-4 h-28 w-20 rounded-2xl overflow-hidden border border-white/40 bg-black/40 shadow-xl transition ${
              videoFullscreen ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
            onClick={onToggleVideoFocus}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter") onToggleVideoFocus();
            }}
          >
            <video
              ref={mainVideoIsRemote ? localVideoRef : remoteVideoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={(event) => {
                event.currentTarget.play().catch(() => undefined);
              }}
              className="h-full w-full object-cover"
            />
          </div>

          <div
            className={`absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-0 right-0 px-6 transition ${
              videoFullscreen ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <div className="mx-auto w-full max-w-sm rounded-full bg-black/50 px-6 py-3 flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={localVideoOn ? onToggleCamera : onEnableCamera}
                className={`h-12 w-12 rounded-full flex items-center justify-center transition active:scale-95 ${
                  localVideoOn ? "bg-white/15 text-white" : "bg-white text-emerald-900"
                }`}
                aria-label={localVideoOn ? "Turn camera off" : "Enable camera"}
              >
                {localVideoOn ? (
                  <VideoCamera size={20} weight="regular" />
                ) : (
                  <VideoCameraSlash size={20} weight="regular" />
                )}
              </button>
              {canFlipCamera && localVideoOn && (
                <button
                  type="button"
                  onClick={onFlipCamera}
                  className="h-12 w-12 rounded-full flex items-center justify-center transition active:scale-95 bg-white/15 text-white"
                  aria-label="Flip camera"
                >
                  <CameraRotate size={20} weight="regular" />
                </button>
              )}
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
                <PhoneDisconnect size={20} weight="regular" className="mx-auto" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`px-0 sm:px-6 pb-4 ${videoFullscreen ? "pt-0" : "pt-4"}`}>
          <div className={`relative ${videoFullscreen ? "h-[55vh] sm:h-[50vh]" : "h-[32vh] sm:h-[28vh]"}`}>
            <div
              className="absolute inset-0 rounded-none sm:rounded-2xl overflow-hidden bg-emerald-900/10 flex items-center justify-center"
              onClick={onToggleVideoFocus}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter") onToggleVideoFocus();
              }}
            >
              <video
                ref={mainVideoIsRemote ? remoteVideoRef : localVideoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(event) => {
                  event.currentTarget.play().catch(() => undefined);
                }}
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-3 left-3 text-xs text-emerald-800 bg-white/80 rounded-full px-2 py-1">
                {mainVideoIsRemote ? callPeer || "Remote" : "You"}
              </div>
              {!remoteVideoOn && mainVideoIsRemote && (
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-emerald-800">
                  {getInitials(callPeer)}
                </div>
              )}
              {!localVideoOn && !mainVideoIsRemote && (
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-emerald-800">
                  {getInitials(localLabel || "You")}
                </div>
              )}
              {!remoteVideoOn && callType === "video" && mainVideoIsRemote && (
                <div className="absolute top-3 left-3 text-xs text-emerald-800 bg-white/80 rounded-full px-2 py-1">
                  Remote camera off
                </div>
              )}
            </div>

            <div
              className="absolute bottom-4 right-4 h-24 w-16 sm:h-28 sm:w-20 rounded-xl overflow-hidden border border-white/70 bg-emerald-900/10 shadow-lg"
              onClick={onToggleVideoFocus}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter") onToggleVideoFocus();
              }}
            >
              <video
                ref={mainVideoIsRemote ? localVideoRef : remoteVideoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(event) => {
                  event.currentTarget.play().catch(() => undefined);
                }}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="absolute top-4 right-4 flex items-center gap-2">
              {callType === "video" && (
                <button
                  type="button"
                  onClick={localVideoOn ? onToggleCamera : onEnableCamera}
                  className="h-9 w-9 rounded-full border border-emerald-200 text-emerald-800 bg-white/90 transition active:scale-95 active:bg-emerald-100"
                  aria-label={localVideoOn ? "Turn camera off" : "Enable camera"}
                >
                  {localVideoOn ? (
                    <VideoCamera size={16} weight="regular" className="mx-auto" />
                  ) : (
                    <VideoCameraSlash size={16} weight="regular" className="mx-auto" />
                  )}
                </button>
              )}
              {callType === "video" && canFlipCamera && localVideoOn && (
                <button
                  type="button"
                  onClick={onFlipCamera}
                  className="h-9 w-9 rounded-full border border-emerald-200 text-emerald-800 bg-white/90 transition active:scale-95 active:bg-emerald-100"
                  aria-label="Flip camera"
                >
                  <CameraRotate size={16} weight="regular" className="mx-auto" />
                </button>
              )}
              <button
                type="button"
                onClick={onToggleVideoFullscreen}
                className="h-9 w-9 rounded-full border border-emerald-200 text-emerald-800 bg-white/90 transition active:scale-95 active:bg-emerald-100"
                aria-label={videoFullscreen ? "Exit full screen" : "Full screen"}
              >
                {videoFullscreen ? (
                  <ArrowsIn size={16} weight="regular" className="mx-auto" />
                ) : (
                  <ArrowsOut size={16} weight="regular" className="mx-auto" />
                )}
              </button>
              <button
                type="button"
                onClick={onEndCall}
                className="h-9 w-9 rounded-full bg-red-500 text-white shadow-lg flex items-center justify-center transition active:scale-95 active:bg-red-600"
                aria-label="Hang up"
              >
                <PhoneDisconnect size={16} weight="regular" className="mx-auto" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
