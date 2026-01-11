"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getIceServers } from "../utils/chat-utils";
import { callHistoryStorageKey } from "../utils/storage";
import { loadJson, storeJson } from "../crypto";

export default function useCallSession({ socket, user }) {
  const [callState, setCallState] = useState("idle");
  const [callPeer, setCallPeer] = useState("");
  const [callType, setCallType] = useState("audio");
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [callNotice, setCallNotice] = useState("");
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [localVideoOn, setLocalVideoOn] = useState(false);
  const [remoteVideoOn, setRemoteVideoOn] = useState(false);
  const [localMicOn, setLocalMicOn] = useState(true);
  const [videoFocus, setVideoFocus] = useState("remote");
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  const [callHistory, setCallHistory] = useState([]);
  const [canFlipCamera, setCanFlipCamera] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callStateRef = useRef("idle");
  const callPeerRef = useRef("");
  const callTypeRef = useRef("audio");
  const lastCallDirectionRef = useRef("outgoing");
  const lastCallLogRef = useRef("");
  const cameraFacingModeRef = useRef("user");

  useEffect(() => {
    if (!user?.username) return;
    const stored = loadJson(callHistoryStorageKey(user.username));
    if (Array.isArray(stored)) {
      setCallHistory(stored);
    }
  }, [user?.username]);

  const recordCallHistory = useCallback(
    (entry) => {
      if (!user?.username) return;
      setCallHistory((prev) => {
        const next = [entry, ...prev].slice(0, 50);
        storeJson(callHistoryStorageKey(user.username), next);
        return next;
      });
    },
    [user?.username],
  );

  useEffect(() => {
    if (callState !== "in-call" || !callPeer) return;
    const key = `${callPeer}:${callTypeRef.current}:${callState}`;
    if (lastCallLogRef.current === key) return;
    lastCallLogRef.current = key;
    recordCallHistory({
      id: `${callPeer}:${Date.now()}`,
      peer: callPeer,
      type: callTypeRef.current,
      direction: lastCallDirectionRef.current,
      at: new Date().toISOString(),
    });
  }, [callState, callPeer, recordCallHistory]);

  useEffect(() => {
    if (callState === "idle") {
      lastCallLogRef.current = "";
    }
  }, [callState]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    callPeerRef.current = callPeer;
  }, [callPeer]);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

  const resetCallState = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    setIncomingOffer(null);
    setCallState("idle");
    setCallPeer("");
    setCallType("audio");
    setCallNotice("");
    setNeedsAudioUnlock(false);
    setLocalVideoOn(false);
    setRemoteVideoOn(false);
    setLocalMicOn(true);
    setVideoFocus("remote");
    setVideoFullscreen(false);
    setCanFlipCamera(false);
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const updateCameraInfo = useCallback(async (stream) => {
    const videoTrack = stream?.getVideoTracks?.()[0];
    const facingMode = videoTrack?.getSettings?.().facingMode;
    if (facingMode) {
      cameraFacingModeRef.current = facingMode;
    }

    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === "videoinput");
      setCanFlipCamera(videoInputs.length > 1);
    } catch (error) {
      setCanFlipCamera(false);
    }
  }, []);

  const attachLocalStream = useCallback(
    (stream) => {
      if (!stream) return;
      localStreamRef.current = stream;
      setLocalStream(stream);
      const videoTrack = stream.getVideoTracks()[0];
      setLocalVideoOn(Boolean(videoTrack));
      setLocalMicOn(Boolean(stream.getAudioTracks()[0]?.enabled ?? true));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => undefined);
      }
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
      }

      if (videoTrack) {
        updateCameraInfo(stream);
      }
    },
    [updateCameraInfo],
  );

  const prepareOutgoingMedia = useCallback(
    async (type) => {
      if (localStreamRef.current) return type;
      const wantsVideo = type === "video";
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: wantsVideo,
        });
        attachLocalStream(stream);
        return wantsVideo ? "video" : "audio";
      } catch (error) {
        if (!wantsVideo) throw error;
        setCallNotice("Camera unavailable. Receiving video only.");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        attachLocalStream(stream);
        return "video";
      }
    },
    [attachLocalStream],
  );

  const ensurePeerConnection = useCallback(
    async (peerName, wantsVideo) => {
      if (peerRef.current) return peerRef.current;
      if (!socket) return null;

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      peerRef.current = pc;

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        socket.emit("call:ice", {
          to: peerName,
          candidate: event.candidate,
        });
      };

      pc.ontrack = (event) => {
        let stream = event.streams?.[0];
        if (!stream) {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          if (!remoteStreamRef.current.getTracks().includes(event.track)) {
            remoteStreamRef.current.addTrack(event.track);
          }
          stream = remoteStreamRef.current;
        }

        remoteStreamRef.current = stream;
        setRemoteStream(stream);

        if (event.track?.kind === "video") {
          setRemoteVideoOn(true);
          event.track.onmute = () => setRemoteVideoOn(false);
          event.track.onunmute = () => setRemoteVideoOn(true);
        }

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(() => undefined);
        }
        if (audioRef.current) {
          audioRef.current.srcObject = stream;
          audioRef.current
            .play()
            .then(() => setNeedsAudioUnlock(false))
            .catch(() => setNeedsAudioUnlock(true));
        }

        setRemoteVideoOn(Boolean(stream.getVideoTracks()[0]));
      };

      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: wantsVideo,
          });
          attachLocalStream(stream);
        } catch (error) {
          if (!wantsVideo) throw error;
          setCallNotice("Camera unavailable. Receiving video only.");
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          attachLocalStream(stream);
        }
      }

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      return pc;
    },
    [attachLocalStream, socket],
  );

  const handleIncomingOffer = useCallback(
    async (from, sdp, type) => {
      if (type) {
        callTypeRef.current = type;
        setCallType(type);
      }
      try {
        const pc = await ensurePeerConnection(
          from,
          (type || callTypeRef.current) === "video",
        );
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call:answer", { to: from, sdp: answer });
        setCallState("in-call");
      } catch (error) {
        setCallNotice("Unable to start the call.");
        resetCallState();
      }
    },
    [ensurePeerConnection, resetCallState, socket],
  );

  const startCall = useCallback(
    async (type) => {
      if (!callPeer || callState !== "idle" || !socket) return;
      setCallNotice("");
      lastCallDirectionRef.current = "outgoing";
      const nextType = await prepareOutgoingMedia(type);
      callTypeRef.current = nextType;
      setCallType(nextType);
      setCallState("calling");
      socket.emit("call:invite", { to: callPeer, type: nextType });
    },
    [callPeer, callState, prepareOutgoingMedia, socket],
  );

  const startDirectCall = useCallback(
    async (peer, type = "audio") => {
      if (!peer || callStateRef.current !== "idle" || !socket) return;
      setCallNotice("");
      lastCallDirectionRef.current = "outgoing";
      setCallPeer(peer);
      callPeerRef.current = peer;
      const nextType = await prepareOutgoingMedia(type);
      callTypeRef.current = nextType;
      setCallType(nextType);
      setCallState("calling");
      socket.emit("call:invite", { to: peer, type: nextType });
    },
    [prepareOutgoingMedia, socket],
  );

  const acceptCall = useCallback(async () => {
    if (!incomingOffer || !socket) return;
    setCallNotice("");

    try {
      const { from, sdp, type } = incomingOffer;
      setIncomingOffer(null);
      lastCallDirectionRef.current = "incoming";
      setCallPeer(from);
      const nextType = type || "audio";
      callTypeRef.current = nextType;
      setCallType(nextType);

      if (!sdp) {
        setCallState("connecting");
        socket.emit("call:accept", { to: from });
        return;
      }

      await handleIncomingOffer(from, sdp);
    } catch (error) {
      setCallNotice("Unable to start the call.");
      resetCallState();
    }
  }, [handleIncomingOffer, incomingOffer, resetCallState, socket]);

  const rejectCall = useCallback(() => {
    if (incomingOffer && socket) {
      socket.emit("call:reject", { to: incomingOffer.from });
    }
    setCallNotice("Call rejected.");
    setIncomingOffer(null);
    setCallState("idle");
  }, [incomingOffer, socket]);

  const cancelCall = useCallback(() => {
    if (socket && callPeer) {
      socket.emit("call:reject", { to: callPeer });
    }
    setCallNotice("Call canceled.");
    resetCallState();
  }, [callPeer, resetCallState, socket]);

  const endCall = useCallback(() => {
    if (socket && callPeer) {
      socket.emit("call:end", { to: callPeer });
    }
    resetCallState();
  }, [callPeer, resetCallState, socket]);

  const unlockAudio = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current
      .play()
      .then(() => {
        setNeedsAudioUnlock(false);
        setCallNotice("");
      })
      .catch(() => {
        setNeedsAudioUnlock(true);
      });
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    const nextState = !track.enabled;
    track.enabled = nextState;
    setLocalVideoOn(nextState);
  }, []);

  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    const currentTrack = localStreamRef.current.getVideoTracks()[0];
    if (!currentTrack) return;

    const nextFacing =
      cameraFacingModeRef.current === "environment" ? "user" : "environment";

    let applied = false;
    try {
      await currentTrack.applyConstraints({ facingMode: { exact: nextFacing } });
      applied = true;
    } catch (error) {
      try {
        await currentTrack.applyConstraints({ facingMode: nextFacing });
        applied = true;
      } catch (innerError) {
        applied = false;
      }
    }

    if (applied) {
      cameraFacingModeRef.current = nextFacing;
      setLocalVideoOn(true);
      return;
    }

    if (!peerRef.current || !socket) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;

      const sender = peerRef.current
        .getSenders()
        .find((item) => item.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(newTrack);
      } else {
        peerRef.current.addTrack(newTrack, localStreamRef.current);
      }

      localStreamRef.current.removeTrack(currentTrack);
      currentTrack.stop();
      localStreamRef.current.addTrack(newTrack);
      setLocalStream(localStreamRef.current);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      cameraFacingModeRef.current = nextFacing;
      setLocalVideoOn(true);
      await updateCameraInfo(localStreamRef.current);

      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);
      socket.emit("call:offer", {
        to: callPeerRef.current,
        sdp: offer,
        type: callTypeRef.current,
      });
    } catch (error) {
      setCallNotice("Unable to switch camera.");
    }
  }, [socket, updateCameraInfo]);

  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (!track) return;
    const nextState = !track.enabled;
    track.enabled = nextState;
    setLocalMicOn(nextState);
  }, []);

  const toggleVideoFocus = useCallback(() => {
    setVideoFocus((prev) => (prev === "remote" ? "local" : "remote"));
  }, []);

  const toggleVideoFullscreen = useCallback(() => {
    setVideoFullscreen((prev) => !prev);
  }, []);

  const enableCamera = useCallback(async () => {
    if (!peerRef.current || !localStreamRef.current || !socket) return;
    if (localStreamRef.current.getVideoTracks().length > 0) {
      setLocalVideoOn(true);
      return;
    }

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = videoStream.getVideoTracks()[0];
      if (!videoTrack) return;

      localStreamRef.current.addTrack(videoTrack);
      peerRef.current.addTrack(videoTrack, localStreamRef.current);
      setLocalVideoOn(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setLocalStream(localStreamRef.current);

      await updateCameraInfo(localStreamRef.current);

      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);
      socket.emit("call:offer", {
        to: callPeerRef.current,
        sdp: offer,
        type: callTypeRef.current,
      });
    } catch (error) {
      setCallNotice("Camera permission denied.");
    }
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handleInvite = ({ from, type }) => {
      if (
        callStateRef.current !== "idle" &&
        callPeerRef.current &&
        callPeerRef.current !== from
      ) {
        socket.emit("call:reject", { to: from });
        return;
      }

      lastCallDirectionRef.current = "incoming";
      const nextType = type || "audio";
      callTypeRef.current = nextType;
      setCallType(nextType);
      setCallPeer(from);
      setIncomingOffer({ from, type: nextType });
      setCallState("ringing");
    };

    const handleAccept = async ({ from }) => {
      if (!from || callPeerRef.current !== from) return;

      try {
        const pc = await ensurePeerConnection(
          from,
          callTypeRef.current === "video",
        );
        if (!pc) return;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:offer", {
          to: from,
          sdp: offer,
          type: callTypeRef.current,
        });
        setCallState("connecting");
      } catch (error) {
        setCallNotice("Unable to start the call.");
        resetCallState();
      }
    };

    const handleOffer = ({ from, sdp, type }) => {
      if (!from || !sdp) return;
      if (
        callStateRef.current !== "idle" &&
        callPeerRef.current &&
        callPeerRef.current !== from
      ) {
        socket.emit("call:reject", { to: from });
        return;
      }

      if (callStateRef.current === "in-call") {
        handleIncomingOffer(from, sdp, type);
        return;
      }

      if (callStateRef.current === "connecting") {
        handleIncomingOffer(from, sdp, type);
        return;
      }

      setCallPeer(from);
      const nextType = type || callTypeRef.current;
      callTypeRef.current = nextType;
      setCallType(nextType);
      setIncomingOffer({ from, sdp, type: nextType });
      setCallState("ringing");
    };

    const handleAnswer = async ({ from, sdp }) => {
      if (!peerRef.current || callPeerRef.current !== from) return;
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      setCallState("in-call");
    };

    const handleIce = async ({ from, candidate }) => {
      if (!peerRef.current || callPeerRef.current !== from) return;
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("ICE candidate error", error);
      }
    };

    const handleReject = ({ from }) => {
      if (callPeerRef.current !== from) return;
      setCallNotice(`${from} rejected the call.`);
      resetCallState();
    };

    const handleBusy = ({ to }) => {
      if (callPeerRef.current !== to) return;
      setCallNotice(`${to} is busy.`);
      resetCallState();
    };

    const handleUnavailable = ({ to }) => {
      if (callPeerRef.current !== to) return;
      setCallNotice(`${to} is unavailable.`);
      resetCallState();
    };

    const handleEnd = ({ from }) => {
      if (callPeerRef.current !== from) return;
      setCallNotice(`Call ended by ${from}.`);
      resetCallState();
    };

    socket.on("call:invite", handleInvite);
    socket.on("call:accept", handleAccept);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice", handleIce);
    socket.on("call:reject", handleReject);
    socket.on("call:busy", handleBusy);
    socket.on("call:unavailable", handleUnavailable);
    socket.on("call:end", handleEnd);

    return () => {
      socket.off("call:invite", handleInvite);
      socket.off("call:accept", handleAccept);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice", handleIce);
      socket.off("call:reject", handleReject);
      socket.off("call:busy", handleBusy);
      socket.off("call:unavailable", handleUnavailable);
      socket.off("call:end", handleEnd);
    };
  }, [ensurePeerConnection, handleIncomingOffer, resetCallState, socket]);

  const showVideoPanel =
    callState !== "idle" && (callType === "video" || localVideoOn);
  const mainVideoIsRemote = videoFocus === "remote";
  const hideChatPanel =
    (callType === "video" && videoFullscreen) ||
    (callType === "audio" && callState !== "idle");

  return useMemo(
    () => ({
      audioRef,
      localVideoRef,
      remoteVideoRef,
      callState,
      callPeer,
      callType,
      incomingOffer,
      callNotice,
      needsAudioUnlock,
      localVideoOn,
      remoteVideoOn,
      localMicOn,
      videoFocus,
      videoFullscreen,
      showVideoPanel,
      mainVideoIsRemote,
      hideChatPanel,
      callHistory,
      canFlipCamera,
      localStream,
      remoteStream,
      setCallPeer,
      setCallType,
      setCallState,
      startCall,
      startDirectCall,
      acceptCall,
      rejectCall,
      cancelCall,
      endCall,
      toggleCamera,
      enableCamera,
      switchCamera,
      toggleMic,
      toggleVideoFocus,
      toggleVideoFullscreen,
      unlockAudio,
      resetCallState,
    }),
    [
      acceptCall,
      callHistory,
      callNotice,
      callPeer,
      callState,
      callType,
      cancelCall,
      canFlipCamera,
      enableCamera,
      endCall,
      hideChatPanel,
      incomingOffer,
      localMicOn,
      localVideoOn,
      mainVideoIsRemote,
      localStream,
      needsAudioUnlock,
      rejectCall,
      remoteStream,
      remoteVideoOn,
      showVideoPanel,
      startCall,
      startDirectCall,
      switchCamera,
      toggleCamera,
      toggleMic,
      toggleVideoFocus,
      toggleVideoFullscreen,
      unlockAudio,
      videoFocus,
      videoFullscreen,
    ],
  );
}
