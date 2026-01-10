"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  base64ToBuffer,
  bufferToBase64,
  decryptAesGcm,
  deriveBits,
  encryptAesGcm,
  exportKey,
  generateIdentityKeyPair,
  hkdf,
  importPrivateKey,
  importPublicKey,
  loadJson,
  randomBytes,
  sha256,
  storeJson,
} from "./crypto";

const isPrivateHost = (hostname) => {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname.startsWith("192.168.")) return true;
  if (hostname.startsWith("10.")) return true;
  if (hostname.startsWith("172.")) {
    const parts = hostname.split(".");
    const second = Number(parts[1]);
    return second >= 16 && second <= 31;
  }
  return false;
};

const resolveSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  if (typeof window !== "undefined") {
    if (isPrivateHost(window.location.hostname)) {
      return `http://${window.location.hostname}:3001`;
    }
    return window.location.origin;
  }

  return "http://localhost:3001";
};

const resolveApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  if (typeof window !== "undefined") {
    if (isPrivateHost(window.location.hostname)) {
      return `http://${window.location.hostname}:3001`;
    }
    return window.location.origin;
  }
  return "http://localhost:3001";
};

const formatTime = (timestamp) => {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getInitials = (name) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

const getAvatarColor = (name) => {
  if (!name) return "#e0f2e9";
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 85%)`;
};

const parseUserList = (value) => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const parseUrls = (value) => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const getIceServers = () => {
  const stunUrls = parseUrls(process.env.NEXT_PUBLIC_STUN_URLS);
  const turnUrls = parseUrls(process.env.NEXT_PUBLIC_TURN_URLS);
  const servers = [];

  if (stunUrls.length) {
    servers.push({ urls: stunUrls });
  } else {
    servers.push({
      urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
    });
  }

  if (turnUrls.length) {
    servers.push({
      urls: turnUrls,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || "",
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "",
    });
  }

  return servers;
};

const identityStorageKey = (username) => `pulsechat:identity:${username}`;
const conversationStorageKey = (userId, conversationId) =>
  `pulsechat:conv:${userId}:${conversationId}`;

export default function Home() {
  const [authMode, setAuthMode] = useState("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [token, setToken] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [authOffline, setAuthOffline] = useState(false);
  const [user, setUser] = useState(null);
  const [usersOnline, setUsersOnline] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [messageDraft, setMessageDraft] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("offline");
  const [callState, setCallState] = useState("idle");
  const [callPeer, setCallPeer] = useState("");
  const [callType, setCallType] = useState("audio");
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [callNotice, setCallNotice] = useState("");
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [localVideoOn, setLocalVideoOn] = useState(false);
  const [remoteVideoOn, setRemoteVideoOn] = useState(false);
  const [videoFocus, setVideoFocus] = useState("remote");
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  const [search, setSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState("chat");
  const [composerTitle, setComposerTitle] = useState("");
  const [composerMembers, setComposerMembers] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [notice, setNotice] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const searchRef = useRef(null);
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callStateRef = useRef("idle");
  const callPeerRef = useRef("");
  const callTypeRef = useRef("audio");
  const identityRef = useRef(null);
  const conversationsRef = useRef([]);

  const apiUrl = resolveApiUrl();

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
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    callPeerRef.current = callPeer;
  }, [callPeer]);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const apiFetch = async (path, options = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Request failed");
    }

    return response.json();
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      setNotice("Notifications not supported in this browser.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
  };

  const resetCallState = () => {
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

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    remoteStreamRef.current = null;

    setIncomingOffer(null);
    setCallState("idle");
    setCallPeer("");
    callTypeRef.current = "audio";
    setCallType("audio");
    setNeedsAudioUnlock(false);
    setLocalVideoOn(false);
    setRemoteVideoOn(false);
    setVideoFocus("remote");
    setVideoFullscreen(false);
  };

  const ensurePeerConnection = async (peerName, enableVideo) => {
    if (peerRef.current) return peerRef.current;

    const pc = new RTCPeerConnection({ iceServers: getIceServers() });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("call:ice", {
          to: peerName,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (!stream) return;

      remoteStreamRef.current = stream;
      setRemoteVideoOn(stream.getVideoTracks().length > 0);

      if (audioRef.current) {
        audioRef.current.srcObject = stream;
        audioRef.current.muted = false;
        audioRef.current
          .play()
          .catch(() => {
            setNeedsAudioUnlock(true);
            setCallNotice("Tap to enable audio playback.");
          });
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.muted = true;
        remoteVideoRef.current
          .play()
          .catch(() => {});
      }
    };

    const wantsVideo = enableVideo ?? callTypeRef.current === "video";
    let stream = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantsVideo,
      });
    } catch (error) {
      if (wantsVideo) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setCallNotice("Camera permission denied. Audio only.");
        setCallType("audio");
        callTypeRef.current = "audio";
      } else {
        throw error;
      }
    }

    localStreamRef.current = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const videoTrack = stream.getVideoTracks()[0];
    setLocalVideoOn(Boolean(videoTrack));

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true;
      localVideoRef.current
        .play()
        .catch(() => {});
    }

    peerRef.current = pc;
    return pc;
  };

  const handleIncomingOffer = async (from, sdp, type) => {
    if (type) {
      callTypeRef.current = type;
      setCallType(type);
    }
    try {
      const pc = await ensurePeerConnection(
        from,
        (type || callTypeRef.current) === "video",
      );
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit("call:answer", { to: from, sdp: answer });
      setCallState("in-call");
    } catch (error) {
      setCallNotice("Unable to start the call.");
      resetCallState();
    }
  };

  const startCall = async (type) => {
    if (!callPeer || callState !== "idle" || !socketRef.current) return;
    setCallNotice("");
    callTypeRef.current = type;
    setCallType(type);
    setCallState("calling");
    socketRef.current.emit("call:invite", { to: callPeer, type });
  };

  const acceptCall = async () => {
    if (!incomingOffer || !socketRef.current) return;
    setCallNotice("");

    try {
      const { from, sdp, type } = incomingOffer;
      setIncomingOffer(null);
      setCallPeer(from);
      const nextType = type || "audio";
      callTypeRef.current = nextType;
      setCallType(nextType);

      if (!sdp) {
        setCallState("connecting");
        socketRef.current.emit("call:accept", { to: from });
        return;
      }

      await handleIncomingOffer(from, sdp);
    } catch (error) {
      setCallNotice("Unable to start the call.");
      resetCallState();
    }
  };

  const rejectCall = () => {
    if (incomingOffer && socketRef.current) {
      socketRef.current.emit("call:reject", { to: incomingOffer.from });
    }
    setCallNotice("Call rejected.");
    resetCallState();
  };

  const endCall = () => {
    if (socketRef.current && callPeer) {
      socketRef.current.emit("call:end", { to: callPeer });
    }
    setCallNotice("Call ended.");
    resetCallState();
  };

  const cancelCall = () => {
    if (socketRef.current && callPeer) {
      socketRef.current.emit("call:reject", { to: callPeer });
    }
    setCallNotice("Call canceled.");
    resetCallState();
  };

  const unlockAudio = () => {
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
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    const nextState = !track.enabled;
    track.enabled = nextState;
    setLocalVideoOn(nextState);
  };

  const toggleVideoFocus = () => {
    setVideoFocus((prev) => (prev === "remote" ? "local" : "remote"));
  };

  const toggleVideoFullscreen = () => {
    setVideoFullscreen((prev) => !prev);
  };

  const enableCamera = async () => {
    if (!peerRef.current || !localStreamRef.current || !socketRef.current) return;
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

      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);
      socketRef.current.emit("call:offer", {
        to: callPeerRef.current,
        sdp: offer,
        type: callTypeRef.current,
      });
    } catch (error) {
      setCallNotice("Camera permission denied.");
    }
  };

  const getConversationState = (conversationId) => {
    if (!user) return null;
    return loadJson(conversationStorageKey(user.id, conversationId));
  };

  const saveConversationState = (conversationId, state) => {
    if (!user) return;
    storeJson(conversationStorageKey(user.id, conversationId), state);
  };

  const clearConversationState = (conversationId) => {
    if (!user) return;
    window.localStorage.removeItem(conversationStorageKey(user.id, conversationId));
  };

  const ensureIdentityKey = async () => {
    if (!user) return null;

    const stored = loadJson(identityStorageKey(user.username));
    if (stored?.privateJwk && stored?.publicJwk) {
      const privateKey = await importPrivateKey(stored.privateJwk);
      identityRef.current = {
        publicJwk: stored.publicJwk,
        privateKey,
      };
      return identityRef.current;
    }

    const keyPair = await generateIdentityKeyPair();
    const publicJwk = await exportKey(keyPair.publicKey);
    const privateJwk = await exportKey(keyPair.privateKey);

    storeJson(identityStorageKey(user.username), { publicJwk, privateJwk });

    identityRef.current = {
      publicJwk,
      privateKey: keyPair.privateKey,
    };

    return identityRef.current;
  };

  const uploadIdentityKey = async () => {
    if (!identityRef.current) return;
    await apiFetch("/api/keys", {
      method: "PUT",
      body: JSON.stringify({ identityKey: JSON.stringify(identityRef.current.publicJwk) }),
    });
  };

  const getUserIdentityKey = async (username) => {
    const payload = await apiFetch(`/api/keys/${username}`);
    return payload.identityKey;
  };

  const deriveConversationKey = async (conversation, otherUsername) => {
    if (!identityRef.current) return null;

    const otherKeyRaw = await getUserIdentityKey(otherUsername);
    const otherKeyJwk = JSON.parse(otherKeyRaw);
    const otherPublicKey = await importPublicKey(otherKeyJwk);

    const shared = await deriveBits(identityRef.current.privateKey, otherPublicKey);
    const salt = new TextEncoder().encode(conversation.id);
    const info = new TextEncoder().encode("pulsechat-direct");
    const keyBytes = await hkdf(shared, salt, info, 32);

    const state = {
      type: "direct",
      key: bufferToBase64(keyBytes),
      senderChains: {},
    };
    saveConversationState(conversation.id, state);
    return state;
  };

  const loadGroupKey = async (conversationId) => {
    if (!identityRef.current) return null;

    const payload = await apiFetch(`/api/conversations/${conversationId}/keys/me`);
    const creatorKeyJwk = JSON.parse(payload.createdBy.identityKey || "{}");
    const creatorKey = await importPublicKey(creatorKeyJwk);
    const shared = await deriveBits(identityRef.current.privateKey, creatorKey);
    const salt = new TextEncoder().encode(`wrap:${conversationId}`);
    const info = new TextEncoder().encode("pulsechat-group-wrap");
    const wrappingKey = await hkdf(shared, salt, info, 32);
    const groupKeyBase64 = await decryptAesGcm(
      wrappingKey,
      payload.wrappedKey,
      payload.iv,
    );

    const state = {
      type: "group",
      key: groupKeyBase64,
      senderChains: {},
    };

    saveConversationState(conversationId, state);
    return state;
  };

  const ensureConversationKey = async (conversation) => {
    const cached = getConversationState(conversation.id);
    if (cached?.key) return cached;

    if (conversation.isGroup) {
      return loadGroupKey(conversation.id);
    }

    const other = conversation.members.find(
      (member) => member.username !== user?.username,
    );
    if (!other) return null;

    return deriveConversationKey(conversation, other.username);
  };

  const deriveSenderChain = async (conversationId, groupKeyBase64, senderId) => {
    const keyBytes = new Uint8Array(base64ToBuffer(groupKeyBase64));
    const salt = new TextEncoder().encode(`sender:${conversationId}`);
    const info = new TextEncoder().encode(`sender:${senderId}`);
    const chainKey = await hkdf(keyBytes, salt, info, 32);
    return { chainKey: bufferToBase64(chainKey), counter: 0 };
  };

  const getSenderChain = async (conversationState, conversationId, senderId) => {
    if (!conversationState.senderChains) {
      conversationState.senderChains = {};
    }

    if (!conversationState.senderChains[senderId]) {
      conversationState.senderChains[senderId] = await deriveSenderChain(
        conversationId,
        conversationState.key,
        senderId,
      );
    }

    return conversationState.senderChains[senderId];
  };

  const encryptMessage = async (conversation, plaintext, extraMetadata = {}) => {
    const state = await ensureConversationKey(conversation);
    if (!state?.key || !user) {
      throw new Error("Missing encryption key");
    }

    const senderChain = await getSenderChain(state, conversation.id, user.id);
    const chainKeyBytes = new Uint8Array(base64ToBuffer(senderChain.chainKey));
    const messageKey = await hkdf(
      chainKeyBytes,
      new TextEncoder().encode(`msg:${conversation.id}`),
      new TextEncoder().encode("pulsechat-message"),
      32,
    );

    const encrypted = await encryptAesGcm(messageKey, plaintext);

    senderChain.chainKey = bufferToBase64(await sha256(chainKeyBytes));
    senderChain.counter += 1;
    saveConversationState(conversation.id, state);

    return {
      body: encrypted.ciphertext,
      metadata: {
        v: 1,
        type: conversation.isGroup ? "group" : "direct",
        iv: encrypted.iv,
        senderId: user.id,
        counter: senderChain.counter - 1,
        ...extraMetadata,
      },
    };
  };

  const decryptMessage = async (conversation, message, retrying = false) => {
    if (!message.metadata || !message.metadata.iv) {
      return message.body;
    }

    const state = await ensureConversationKey(conversation);
    if (!state?.key) {
      return "[Encrypted message]";
    }

    const senderId = message.metadata.senderId || message.sender?.id;
    if (!senderId) {
      return "[Encrypted message]";
    }

    const senderChain = await getSenderChain(state, conversation.id, senderId);
    let chainKeyBytes = new Uint8Array(base64ToBuffer(senderChain.chainKey));

    if (typeof message.metadata.counter !== "number") {
      return "[Encrypted message]";
    }

    while (senderChain.counter < message.metadata.counter) {
      chainKeyBytes = await sha256(chainKeyBytes);
      senderChain.counter += 1;
    }

    const messageKey = await hkdf(
      chainKeyBytes,
      new TextEncoder().encode(`msg:${conversation.id}`),
      new TextEncoder().encode("pulsechat-message"),
      32,
    );

    try {
      const plaintext = await decryptAesGcm(
        messageKey,
        message.body,
        message.metadata.iv,
      );

      senderChain.chainKey = bufferToBase64(await sha256(chainKeyBytes));
      senderChain.counter += 1;
      saveConversationState(conversation.id, state);

      return plaintext;
    } catch (error) {
      if (retrying) {
        return "[Unable to decrypt]";
      }
      clearConversationState(conversation.id);
      const refreshed = await ensureConversationKey(conversation);
      if (!refreshed) {
        return "[Unable to decrypt]";
      }
      return decryptMessage(conversation, message, true);
    }
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const distributeGroupKey = async (conversation) => {
    if (!identityRef.current) return;

    const groupKeyBase64 = bufferToBase64(randomBytes(32));
    const keysPayload = [];

    for (const member of conversation.members) {
      const identityKeyRaw = await getUserIdentityKey(member.username);
      if (!identityKeyRaw) continue;
      const memberKeyJwk = JSON.parse(identityKeyRaw);
      const memberKey = await importPublicKey(memberKeyJwk);

      const shared = await deriveBits(identityRef.current.privateKey, memberKey);
      const salt = new TextEncoder().encode(`wrap:${conversation.id}`);
      const info = new TextEncoder().encode("pulsechat-group-wrap");
      const wrappingKey = await hkdf(shared, salt, info, 32);
      const encrypted = await encryptAesGcm(wrappingKey, groupKeyBase64);

      keysPayload.push({
        userId: member.id,
        wrappedKey: encrypted.ciphertext,
        iv: encrypted.iv,
      });
    }

    await apiFetch(`/api/conversations/${conversation.id}/keys`, {
      method: "POST",
      body: JSON.stringify({ keys: keysPayload }),
    });

    const state = {
      type: "group",
      key: groupKeyBase64,
      senderChains: {},
    };
    saveConversationState(conversation.id, state);
  };

  useEffect(() => {
    const stored = window.localStorage.getItem("pulsechat-token");
    if (stored) {
      setToken(stored);
    } else {
      setAuthChecked(true);
    }

    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      const maxRetries = 2;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          const me = await apiFetch("/api/auth/me");
          setUser(me.user);
          setAuthOffline(false);
          setAuthChecked(true);
          return;
        } catch (error) {
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 600));
          } else {
            setUser(null);
            setAuthOffline(true);
            setAuthChecked(true);
          }
        }
      }
    };

    load();
  }, [token]);

  useEffect(() => {
    if (!user) return;

    const setup = async () => {
      try {
        await ensureIdentityKey();
        await uploadIdentityKey();
      } catch (error) {
        setNotice("Unable to initialize encryption keys.");
      }
    };

    setup();
  }, [user]);

  useEffect(() => {
    if (!token || !user) return;

    const fetchConversations = async () => {
      try {
        const payload = await apiFetch("/api/conversations");
        const mapped = (payload.conversations || []).map((conversation) => {
          if (conversation.lastMessage?.metadata) {
            return { ...conversation, preview: "Encrypted message" };
          }
          return {
            ...conversation,
            preview: conversation.lastMessage?.body || "",
          };
        });
        setConversations(mapped);
      } catch (error) {
        setNotice(error.message);
      }
    };

    fetchConversations();
  }, [token, user]);

  useEffect(() => {
    if (!token || !user) return;

    const socket = io(resolveSocketUrl(), {
      auth: { token },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionStatus("online");
    });

    socket.on("disconnect", () => {
      setConnectionStatus("offline");
      resetCallState();
    });

    socket.on("users:update", ({ users: onlineUsers }) => {
      setUsersOnline(onlineUsers || []);
    });

    socket.on("message:new", async (payload) => {
      const conversation = conversationsRef.current.find(
        (item) => item.id === payload.conversationId,
      );

      let plaintext = "[Encrypted message]";
      if (conversation) {
        try {
          plaintext = await decryptMessage(conversation, payload);
        } catch (error) {
          plaintext = "[Unable to decrypt]";
        }
      }

      const enriched = { ...payload, plaintext };

      if (
        notificationsEnabled &&
        document.hidden &&
        payload.sender?.username &&
        plaintext
      ) {
        new Notification(`💬 ${payload.sender.username}`, {
          body: plaintext,
        });
      }

      setMessagesByConversation((prev) => {
        const updated = { ...prev };
        const thread = updated[payload.conversationId] || [];
        updated[payload.conversationId] = [...thread, enriched];
        return updated;
      });

      setConversations((prev) =>
        prev.map((conversationItem) => {
          if (conversationItem.id !== payload.conversationId) {
            if (payload.sender.username !== user.username) {
              return {
                ...conversationItem,
                unread: conversationItem.unread + 1,
                lastMessage: {
                  id: payload.id,
                  body: payload.body,
                  createdAt: payload.createdAt,
                  senderId: payload.sender.id,
                  metadata: payload.metadata,
                },
                preview: plaintext,
              };
            }
            return conversationItem;
          }

          return {
            ...conversationItem,
            lastMessage: {
              id: payload.id,
              body: payload.body,
              createdAt: payload.createdAt,
              senderId: payload.sender.id,
              metadata: payload.metadata,
            },
            preview: plaintext,
          };
        }),
      );
    });

    socket.on("conversation:created", async ({ conversationId }) => {
      try {
        const refreshed = await apiFetch("/api/conversations");
        setConversations(refreshed.conversations || []);
        socket.emit("conversation:join", { conversationId });
      } catch (error) {
        setNotice(error.message);
      }
    });

    socket.on("call:invite", ({ from, type }) => {
      if (
        callStateRef.current !== "idle" &&
        callPeerRef.current &&
        callPeerRef.current !== from
      ) {
        socket.emit("call:reject", { to: from });
        return;
      }

      const nextType = type || "audio";
      callTypeRef.current = nextType;
      setCallType(nextType);
      setCallPeer(from);
      setIncomingOffer({ from, type: nextType });
      setCallState("ringing");
    });

    socket.on("call:accept", async ({ from }) => {
      if (!from || callPeerRef.current !== from) return;

      try {
        const pc = await ensurePeerConnection(
          from,
          callTypeRef.current === "video",
        );
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:offer", { to: from, sdp: offer, type: callTypeRef.current });
        setCallState("connecting");
      } catch (error) {
        setCallNotice("Unable to start the call.");
        resetCallState();
      }
    });

    socket.on("call:offer", ({ from, sdp, type }) => {
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
    });

    socket.on("call:answer", async ({ from, sdp }) => {
      if (!peerRef.current || callPeerRef.current !== from) return;
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      setCallState("in-call");
    });

    socket.on("call:ice", async ({ from, candidate }) => {
      if (!peerRef.current || callPeerRef.current !== from) return;
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("ICE candidate error", error);
      }
    });

    socket.on("call:reject", ({ from }) => {
      if (callPeerRef.current !== from) return;
      setCallNotice(`${from} rejected the call.`);
      resetCallState();
    });

    socket.on("call:busy", ({ to }) => {
      if (callPeerRef.current !== to) return;
      setCallNotice(`${to} is busy.`);
      resetCallState();
    });

    socket.on("call:unavailable", ({ to }) => {
      if (callPeerRef.current !== to) return;
      setCallNotice(`${to} is unavailable.`);
      resetCallState();
    });

    socket.on("call:end", ({ from }) => {
      if (callPeerRef.current !== from) return;
      setCallNotice(`Call ended by ${from}.`);
      resetCallState();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesByConversation, selectedConversationId]);

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
    if (!userSearch || !token) {
      setUserResults([]);
      return;
    }

    const fetchUsers = async () => {
      try {
        const payload = await apiFetch(`/api/users?search=${userSearch}`);
        setUserResults(payload.users || []);
      } catch (error) {
        setUserResults([]);
      }
    };

    const id = setTimeout(fetchUsers, 200);
    return () => clearTimeout(id);
  }, [userSearch, token]);

  const filteredConversations = useMemo(() => {
    if (!search) return conversations;
    const term = search.toLowerCase();
    return conversations.filter((conversation) => {
      const name =
        conversation.title ||
        conversation.members.map((m) => m.username).join(", ");
      return name.toLowerCase().includes(term);
    });
  }, [conversations, search]);

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId,
  );

  const selectedMessages = messagesByConversation[selectedConversationId] || [];

  const otherMembers = selectedConversation
    ? selectedConversation.members.filter((member) => member.username !== user?.username)
    : [];

  const isGroup = selectedConversation?.isGroup;

  const callTarget = !isGroup && otherMembers.length === 1 ? otherMembers[0].username : "";

  useEffect(() => {
    if (callStateRef.current !== "idle") return;
    setCallPeer(callTarget || "");
  }, [callTarget]);

  const showVideoPanel =
    callState !== "idle" && (callType === "video" || localVideoOn);
  const mainVideoIsRemote = videoFocus === "remote";
  const hideChatPanel =
    (callType === "video" && videoFullscreen) ||
    (callType === "audio" && callState !== "idle");

  const handleAuth = async (event) => {
    event.preventDefault();
    setAuthError("");

    try {
      const payload = await apiFetch(`/api/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify({
          username: authUsername.trim().toLowerCase(),
          password: authPassword,
        }),
      });
      setToken(payload.token);
      window.localStorage.setItem("pulsechat-token", payload.token);
      setUser(payload.user);
      setAuthPassword("");
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const handleSelectConversation = async (conversation) => {
    setSelectedConversationId(conversation.id);
    setMessageDraft("");

    try {
      await ensureConversationKey(conversation);
      const payload = await apiFetch(`/api/conversations/${conversation.id}/messages`);
      const decrypted = [];

      for (const message of payload.messages || []) {
        let plaintext = message.body;
        if (message.metadata) {
          try {
            plaintext = await decryptMessage(conversation, message);
          } catch (error) {
            plaintext = "[Unable to decrypt]";
          }
        }
        decrypted.push({ ...message, plaintext });
      }

      setMessagesByConversation((prev) => ({
        ...prev,
        [conversation.id]: decrypted,
      }));

      await apiFetch(`/api/conversations/${conversation.id}/read`, {
        method: "POST",
      });

      socketRef.current?.emit("conversation:read", { conversationId: conversation.id });

      setConversations((prev) =>
        prev.map((item) =>
          item.id === conversation.id ? { ...item, unread: 0 } : item,
        ),
      );

      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 100);
    } catch (error) {
      setNotice(error.message);
    }
  };

  const handleSend = async () => {
    if (!messageDraft.trim() || !selectedConversationId || !socketRef.current) return;

    const conversation = selectedConversation;
    if (!conversation) return;

    try {
      const encrypted = await encryptMessage(conversation, messageDraft.trim());
      socketRef.current.emit("message:send", {
        conversationId: selectedConversationId,
        body: encrypted.body,
        metadata: encrypted.metadata,
      });

      setMessageDraft("");
    } catch (error) {
      setNotice("Unable to encrypt message.");
    }
  };

  const pushLocalMessage = (conversationId, payload) => {
    setMessagesByConversation((prev) => {
      const updated = { ...prev };
      const thread = updated[conversationId] || [];
      updated[conversationId] = [...thread, payload];
      return updated;
    });
  };

  const handleSendFile = async (file) => {
    if (!file || !selectedConversationId || !socketRef.current) return;
    const conversation = selectedConversation;
    if (!conversation) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      pushLocalMessage(selectedConversationId, {
        id: `local-${Date.now()}-${file.name}`,
        body: dataUrl,
        plaintext: dataUrl,
        metadata: {
          kind: "file",
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
        },
        createdAt: new Date().toISOString(),
        sender: { id: user.id, username: user.username },
      });

      const encrypted = await encryptMessage(conversation, dataUrl, {
        kind: "file",
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
      });
      socketRef.current.emit("message:send", {
        conversationId: selectedConversationId,
        body: encrypted.body,
        metadata: encrypted.metadata,
      });
    } catch (error) {
      setNotice("Unable to send file.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDropFiles = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      handleSendFile(file);
    }
  };

  const handleCreateConversation = async (members, title) => {
    try {
      const payload = await apiFetch("/api/conversations", {
        method: "POST",
        body: JSON.stringify({
          title,
          members,
        }),
      });

      const refreshed = await apiFetch("/api/conversations");
      setConversations(refreshed.conversations || []);
      setComposerOpen(false);
      setComposerMembers("");
      setComposerTitle("");
      setUserSearch("");
      setUserResults([]);

      if (payload.id) {
        setSelectedConversationId(payload.id);
        const created = refreshed.conversations?.find((conv) => conv.id === payload.id);
        if (created?.isGroup) {
          await distributeGroupKey(created);
        }
      }
    } catch (error) {
      setNotice(error.message);
    }
  };

  const handleQuickChat = (username) => {
    handleCreateConversation([username], "");
  };

  const handleLogout = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setToken("");
    setUser(null);
    setConversations([]);
    setSelectedConversationId("");
    setMessagesByConversation({});
    window.localStorage.removeItem("pulsechat-token");
  };

  const handleResetEncryption = () => {
    if (!user) return;
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(`pulsechat:conv:${user.id}:`))
      .forEach((key) => window.localStorage.removeItem(key));
    setNotice("Encryption state reset. Select a conversation to re-sync.");
  };

  if (!token || !user) {
    if (!authChecked) {
      return (
        <div className="min-h-[var(--app-height,100svh)] flex items-center justify-center px-4 py-6 sm:p-6">
          <div className="w-full max-w-md bg-white/85 border border-white/60 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">
              PulseChat
            </p>
            <p className="mt-4 text-sm text-emerald-800">
              Checking your session...
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-6 sm:p-6">
        <form
          onSubmit={handleAuth}
          className="w-full max-w-md bg-white/85 border border-white/60 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-700">
            PulseChat
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold mt-3 text-emerald-950">
            {authMode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-emerald-800 mt-3">
            {authMode === "login"
              ? "Sign in to continue your conversations."
              : "Pick a username and password to get started."}
          </p>

          {authOffline && (
            <div className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              Server unreachable. You can retry login or wait for reconnection.
            </div>
          )}

          {authError && (
            <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              {authError}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-emerald-900">
                Username
              </label>
              <input
                value={authUsername}
                onChange={(event) => setAuthUsername(event.target.value)}
                placeholder="e.g. mia"
                className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white/90 px-4 py-3 text-base outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-emerald-900">
                Password
              </label>
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="••••••••"
                className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white/90 px-4 py-3 text-base outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 w-full rounded-2xl bg-emerald-600 text-white py-3 font-semibold hover:bg-emerald-700 transition"
          >
            {authMode === "login" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
            className="mt-4 w-full text-sm text-emerald-700"
          >
            {authMode === "login"
              ? "Need an account? Register"
              : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    );
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
      <audio ref={audioRef} autoPlay playsInline />
      <div className="w-full h-[var(--app-height,100svh)] sm:h-[92svh] md:h-[84vh] max-w-6xl bg-white/80 border border-white/70 sm:rounded-3xl shadow-2xl backdrop-blur overflow-hidden pb-[env(safe-area-inset-bottom)] relative">
        {dragActive && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-emerald-900/20 backdrop-blur">
            <div className="rounded-2xl border border-emerald-200 bg-white/90 px-6 py-4 text-sm text-emerald-900">
              Drop a file to send
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-full">
          <aside
            className={`h-full border-r border-white/70 bg-gradient-to-b from-emerald-100/70 via-white/70 to-orange-100/70 p-5 sm:p-6 ${
              selectedConversationId ? "hidden md:block" : "block"
            }`}
          >
            <div className="flex items-center justify-between">
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

            <div className="mt-5 flex gap-2">
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
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search conversations"
                  className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                />
                <span className="absolute right-4 top-3.5 text-xs text-emerald-500">
                  Ctrl/Cmd + K
                </span>
              </div>
            </div>

            <div className="mt-5">
              <label className="text-xs uppercase tracking-[0.3em] text-emerald-700">
                Conversations
              </label>
              <div className="mt-3 space-y-2">
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
                  const online = conversation.members.some((member) =>
                    usersOnline.some((onlineUser) => onlineUser.username === member.username),
                  );

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                      className={`w-full text-left rounded-2xl p-4 border transition ${
                        isActive
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white/80 text-emerald-950 border-white/70 hover:border-emerald-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              online ? "bg-emerald-500" : "bg-amber-400"
                            }`}
                          />
                          <span className="font-semibold text-base">
                            {conversationName || "Untitled"}
                          </span>
                        </div>
                        {conversation.lastMessage && (
                          <span className="text-xs opacity-80">
                            {formatTime(conversation.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <p
                          className={`text-sm truncate ${
                            isActive ? "text-white/80" : "text-emerald-700/80"
                          }`}
                        >
                          {conversation.preview || "Start a new chat"}
                        </p>
                        {conversation.unread > 0 && (
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              isActive
                                ? "bg-white text-emerald-600"
                                : "bg-emerald-600 text-white"
                            }`}
                          >
                            {conversation.unread}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={requestNotifications}
              className="mt-4 w-full rounded-2xl border border-emerald-200 text-emerald-800 bg-white px-4 py-3 text-xs font-semibold transition active:scale-95 active:bg-emerald-100"
            >
              {notificationsEnabled ? "Notifications enabled" : "Enable notifications"}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 text-xs text-emerald-700 transition active:scale-95"
            >
              Sign out
            </button>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-700">
                Security
              </p>
              <p className="mt-2 text-xs text-amber-800">
                If messages fail to decrypt, reset the local encryption cache.
              </p>
              <button
                type="button"
                onClick={handleResetEncryption}
                className="mt-3 w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition active:scale-[0.98] active:bg-amber-100"
              >
                Reset encryption state
              </button>
            </div>
          </aside>

          <main
            className={`h-full min-h-0 flex flex-col ${
              selectedConversationId ? "flex" : "hidden md:flex"
            }`}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/70 px-5 py-4 sm:px-6 bg-white/90 backdrop-blur">
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
                      onClick={() => startCall("audio")}
                      disabled={callState !== "idle" || connectionStatus !== "online"}
                      className="h-9 w-9 rounded-full border border-emerald-200 text-emerald-800 bg-white disabled:opacity-50 transition active:scale-95 active:bg-emerald-50"
                      aria-label="Start voice call"
                    >
                      <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M15 5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1l-4 3v-3H9a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6z"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => startCall("video")}
                      disabled={callState !== "idle" || connectionStatus !== "online"}
                      className="h-9 w-9 rounded-full border border-emerald-200 text-emerald-800 bg-white disabled:opacity-50 transition active:scale-95 active:bg-emerald-50"
                      aria-label="Start video call"
                    >
                      <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="7" width="12" height="10" rx="2" />
                        <path d="M15 10l5-3v10l-5-3z" />
                      </svg>
                    </button>
                  </>
                )}
                {selectedConversationId && (
                  <button
                    type="button"
                    onClick={() => setSelectedConversationId("")}
                    className="text-xs px-3 py-1 rounded-full border border-emerald-200 text-emerald-800 bg-white md:hidden"
                  >
                    Back
                  </button>
                )}
              </div>
            </div>

            {notice && (
              <div className="px-5 py-3 sm:px-6 text-xs text-emerald-800 bg-emerald-100 border-b border-emerald-200">
                {notice}
              </div>
            )}

            {callNotice && (
              <div className="px-5 py-3 sm:px-6 text-xs text-emerald-800 bg-emerald-100 border-b border-emerald-200">
                {callNotice}
              </div>
            )}

            {callState === "calling" && (
              <div className="px-5 py-3 sm:px-6 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
                <span>
                  Calling {callPeer} ({callType})...
                </span>
                <button
                  type="button"
                  onClick={cancelCall}
                  className="h-9 w-9 rounded-full border border-emerald-200 text-emerald-800 bg-white transition active:scale-95 active:bg-emerald-100"
                  aria-label="Cancel call"
                >
                  <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            )}

            {callState === "connecting" && (
              <div className="px-5 py-3 sm:px-6 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
                <span>
                  Connecting to {callPeer} ({callType})...
                </span>
              </div>
            )}

            {callState === "in-call" && (
              <div className="px-5 py-3 sm:px-6 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
                <span>
                  In {callType} call with {callPeer}
                </span>
              </div>
            )}

            {needsAudioUnlock && callState !== "idle" && (
              <div className="px-5 py-3 sm:px-6 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
                <span>Audio is muted by the browser.</span>
                <button
                  type="button"
                  onClick={unlockAudio}
                  className="text-xs px-3 py-1 rounded-full border border-emerald-200 text-emerald-800 bg-white transition active:scale-95 active:bg-emerald-100"
                >
                  Enable audio
                </button>
              </div>
            )}

            {callType === "audio" && callState !== "idle" && (
              <div className={`px-5 sm:px-6 pb-4 pt-4 ${hideChatPanel ? "flex-1 flex items-center" : ""}`}>
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
                      onClick={endCall}
                      className="h-11 w-11 rounded-full bg-red-500 text-white shadow-lg transition active:scale-95 active:bg-red-600"
                      aria-label="Hang up"
                    >
                      <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M6 8h12a3 3 0 0 1 3 3v2a1 1 0 0 1-1 1h-2l-2-2H8l-2 2H4a1 1 0 0 1-1-1v-2a3 3 0 0 1 3-3z" />
                      </svg>
                    </button>
                    <span className="text-xs text-emerald-700">
                      {callState === "calling" && "Calling..."}
                      {callState === "connecting" && "Connecting..."}
                      {callState === "in-call" && "Connected"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {showVideoPanel && (
              <div className={`px-0 sm:px-6 pb-4 ${videoFullscreen ? "pt-0" : "pt-4"}`}>
                <div className={`relative ${videoFullscreen ? "h-[55vh] sm:h-[50vh]" : "h-[32vh] sm:h-[28vh]"}`}>
                  <div
                    className="absolute inset-0 rounded-none sm:rounded-2xl overflow-hidden bg-emerald-900/10 flex items-center justify-center"
                    onClick={toggleVideoFocus}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") toggleVideoFocus();
                    }}
                  >
                    <video
                      ref={mainVideoIsRemote ? remoteVideoRef : localVideoRef}
                      autoPlay
                      playsInline
                      muted={!mainVideoIsRemote}
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
                        {getInitials(user.username)}
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
                    onClick={toggleVideoFocus}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") toggleVideoFocus();
                    }}
                  >
                    <video
                      ref={mainVideoIsRemote ? localVideoRef : remoteVideoRef}
                      autoPlay
                      playsInline
                      muted={mainVideoIsRemote}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {callType === "video" && (
                      <button
                        type="button"
                        onClick={localVideoOn ? toggleCamera : enableCamera}
                        className="h-9 w-9 rounded-full border border-emerald-200 text-emerald-800 bg-white/90 transition active:scale-95 active:bg-emerald-100"
                        aria-label={localVideoOn ? "Turn camera off" : "Enable camera"}
                      >
                        <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="3" y="7" width="12" height="10" rx="2" />
                          <path d="M15 10l5-3v10l-5-3z" />
                          {!localVideoOn && <path d="M4 20L20 4" />}
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={toggleVideoFullscreen}
                      className="h-9 w-9 rounded-full border border-emerald-200 text-emerald-800 bg-white/90 transition active:scale-95 active:bg-emerald-100"
                      aria-label={videoFullscreen ? "Exit full screen" : "Full screen"}
                    >
                      <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={endCall}
                      className="h-9 w-9 rounded-full bg-red-500 text-white shadow-lg transition active:scale-95 active:bg-red-600"
                      aria-label="Hang up"
                    >
                      <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M6 8h12a3 3 0 0 1 3 3v2a1 1 0 0 1-1 1h-2l-2-2H8l-2 2H4a1 1 0 0 1-1-1v-2a3 3 0 0 1 3-3z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!hideChatPanel && (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-6 sm:px-6 sm:py-6 space-y-4 bg-white/40 overscroll-y-contain">
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
                      const isImage =
                        isFile && (message.metadata?.mime || "").startsWith("image/");

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
                                  className="block rounded-xl border border-emerald-100 bg-white/80 px-3 py-2 text-sm text-emerald-800 hover:border-emerald-300"
                                >
                                  📎 {message.metadata?.name || "Download file"}
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

                <div className="sticky bottom-0 z-20 border-t border-white/70 bg-white/95 backdrop-blur px-5 py-4 sm:px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="flex gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(event) => handleSendFile(event.target.files?.[0])}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!selectedConversationId}
                      className="h-11 w-11 rounded-full border border-emerald-200 text-emerald-800 bg-white transition active:scale-95 active:bg-emerald-100 disabled:opacity-50"
                      aria-label="Send file"
                    >
                      <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M12 5v12a3 3 0 1 1-6 0V7a4 4 0 0 1 8 0v9a2 2 0 1 1-4 0V8" />
                      </svg>
                    </button>
                    <input
                      ref={messageInputRef}
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={
                        selectedConversationId
                          ? "Type a message"
                          : "Select a conversation first"
                      }
                      disabled={!selectedConversationId}
                      className="flex-1 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 disabled:bg-gray-100"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!selectedConversationId}
                      className="h-11 w-11 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:bg-emerald-300 transition active:scale-95 active:bg-emerald-700"
                      aria-label="Send message"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M3 12l18-9-4 18-5-6-9-3z" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-emerald-600">
                    Enter to send, Shift + Enter for new line.
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {composerOpen && (
        <div className="fixed inset-0 bg-emerald-950/40 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-emerald-950">
                {composerMode === "chat" ? "Start a chat" : "Create a group"}
              </h3>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="text-sm text-emerald-700"
              >
                Close
              </button>
            </div>

            {composerMode === "chat" ? (
              <div className="mt-4">
                <label className="text-sm font-medium text-emerald-900">
                  Search users
                </label>
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Type a username"
                  className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500"
                />
                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                  {userResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleQuickChat(result.username)}
                      className="w-full text-left rounded-2xl border border-emerald-100 px-4 py-3 text-sm text-emerald-900 hover:border-emerald-300"
                    >
                      {result.username}
                    </button>
                  ))}
                  {userSearch && userResults.length === 0 && (
                    <div className="text-sm text-emerald-600">
                      No users found.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-emerald-900">
                    Group name
                  </label>
                  <input
                    value={composerTitle}
                    onChange={(event) => setComposerTitle(event.target.value)}
                    placeholder="e.g. Weekend Team"
                    className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-emerald-900">
                    Members (comma separated usernames)
                  </label>
                  <input
                    value={composerMembers}
                    onChange={(event) => setComposerMembers(event.target.value)}
                    placeholder="mia, alex, tom"
                    className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCreateConversation(parseUserList(composerMembers), composerTitle)
                  }
                  className="w-full rounded-2xl bg-emerald-600 text-white py-3 font-semibold"
                >
                  Create group
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {callState === "ringing" && incomingOffer && (
        <div className="fixed inset-0 bg-emerald-950/30 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">
              Incoming {incomingOffer.type || "audio"} call
            </p>
            <h3 className="text-2xl font-semibold text-emerald-950 mt-3">
              {incomingOffer.from}
            </h3>
            <p className="text-sm text-emerald-700 mt-2">
              Accept the call?
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={rejectCall}
                className="rounded-2xl border border-emerald-200 px-4 py-2 text-sm text-emerald-800"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={acceptCall}
                className="rounded-2xl bg-emerald-600 text-white px-4 py-2 text-sm"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
