"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

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

const formatDate = (timestamp) => {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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

export default function Home() {
  const [authMode, setAuthMode] = useState("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [token, setToken] = useState("");
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
  const [search, setSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState("chat");
  const [composerTitle, setComposerTitle] = useState("");
  const [composerMembers, setComposerMembers] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [notice, setNotice] = useState("");

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const searchRef = useRef(null);
  const messageInputRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callStateRef = useRef("idle");
  const callPeerRef = useRef("");
  const callTypeRef = useRef("audio");

  const apiUrl = resolveApiUrl();

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    callPeerRef.current = callPeer;
  }, [callPeer]);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

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

  const handleIncomingOffer = async (from, sdp) => {
    try {
      const pc = await ensurePeerConnection(from, callTypeRef.current === "video");
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

  useEffect(() => {
    const stored = window.localStorage.getItem("pulsechat-token");
    if (stored) {
      setToken(stored);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        const me = await apiFetch("/api/auth/me");
        setUser(me.user);
      } catch (error) {
        setToken("");
        setUser(null);
        window.localStorage.removeItem("pulsechat-token");
      }
    };

    load();
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;

    const fetchConversations = async () => {
      try {
        const payload = await apiFetch("/api/conversations");
        setConversations(payload.conversations || []);
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

    socket.on("message:new", (payload) => {
      setMessagesByConversation((prev) => {
        const updated = { ...prev };
        const thread = updated[payload.conversationId] || [];
        updated[payload.conversationId] = [...thread, payload];
        return updated;
      });

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== payload.conversationId) {
            if (payload.sender.username !== user.username) {
              return {
                ...conversation,
                unread: conversation.unread + 1,
                lastMessage: {
                  id: payload.id,
                  body: payload.body,
                  createdAt: payload.createdAt,
                  senderId: payload.sender.id,
                },
              };
            }
            return conversation;
          }

          return {
            ...conversation,
            lastMessage: {
              id: payload.id,
              body: payload.body,
              createdAt: payload.createdAt,
              senderId: payload.sender.id,
            },
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
        socket.emit("call:offer", { to: from, sdp: offer });
        setCallState("connecting");
      } catch (error) {
        setCallNotice("Unable to start the call.");
        resetCallState();
      }
    });

    socket.on("call:offer", ({ from, sdp }) => {
      if (!from || !sdp) return;
      if (
        callStateRef.current !== "idle" &&
        callPeerRef.current &&
        callPeerRef.current !== from
      ) {
        socket.emit("call:reject", { to: from });
        return;
      }

      if (callStateRef.current === "connecting") {
        handleIncomingOffer(from, sdp);
        return;
      }

      setCallPeer(from);
      setIncomingOffer({ from, sdp });
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
      const name = conversation.title || conversation.members.map((m) => m.username).join(", ");
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
      const payload = await apiFetch(`/api/conversations/${conversation.id}/messages`);
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversation.id]: payload.messages || [],
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

  const handleSend = () => {
    if (!messageDraft.trim() || !selectedConversationId || !socketRef.current) return;

    socketRef.current.emit("message:send", {
      conversationId: selectedConversationId,
      body: messageDraft.trim(),
    });

    setMessageDraft("");
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

  if (!token || !user) {
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
    <div className="min-h-screen flex items-center justify-center px-4 py-6 sm:p-6">
      <audio ref={audioRef} autoPlay playsInline />
      <div className="w-full max-w-6xl h-[92svh] md:h-[84vh] bg-white/75 border border-white/70 rounded-3xl shadow-2xl backdrop-blur overflow-hidden">
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
                className="text-xs px-3 py-2 rounded-2xl border border-emerald-200 text-emerald-800 bg-white"
              >
                New chat
              </button>
              <button
                type="button"
                onClick={() => {
                  setComposerMode("group");
                  setComposerOpen(true);
                }}
                className="text-xs px-3 py-2 rounded-2xl border border-emerald-200 text-emerald-800 bg-white"
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
                          {conversation.lastMessage
                            ? conversation.lastMessage.body
                            : "Start a new chat"}
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
              onClick={handleLogout}
              className="mt-6 text-xs text-emerald-700"
            >
              Sign out
            </button>
          </aside>

          <main
            className={`h-full flex flex-col ${
              selectedConversationId ? "flex" : "hidden md:flex"
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/70 px-5 py-4 sm:px-6 bg-white/70">
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
                      className="text-xs px-3 py-1 rounded-full border border-emerald-200 text-emerald-800 bg-white disabled:opacity-50"
                    >
                      Call
                    </button>
                    <button
                      type="button"
                      onClick={() => startCall("video")}
                      disabled={callState !== "idle" || connectionStatus !== "online"}
                      className="text-xs px-3 py-1 rounded-full border border-emerald-200 text-emerald-800 bg-white disabled:opacity-50"
                    >
                      Video
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
                  className="text-xs px-3 py-1 rounded-full border border-emerald-200 text-emerald-800 bg-white"
                >
                  Cancel
                </button>
              </div>
            )}

            {callState === "connecting" && (
              <div className="px-5 py-3 sm:px-6 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
                <span>
                  Connecting to {callPeer} ({callType})...
                </span>
                <button
                  type="button"
                  onClick={endCall}
                  className="text-xs px-3 py-1 rounded-full border border-emerald-200 text-emerald-800 bg-white"
                >
                  Hang up
                </button>
              </div>
            )}

            {callState === "in-call" && (
              <div className="px-5 py-3 sm:px-6 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
                <span>
                  In {callType} call with {callPeer}
                </span>
                <button
                  type="button"
                  onClick={endCall}
                  className="text-xs px-3 py-1 rounded-full border border-emerald-200 text-emerald-800 bg-white"
                >
                  Hang up
                </button>
              </div>
            )}

            {needsAudioUnlock && callState !== "idle" && (
              <div className="px-5 py-3 sm:px-6 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
                <span>Audio is muted by the browser.</span>
                <button
                  type="button"
                  onClick={unlockAudio}
                  className="text-xs px-3 py-1 rounded-full border border-emerald-200 text-emerald-800 bg-white"
                >
                  Enable audio
                </button>
              </div>
            )}

            {showVideoPanel && (
              <div className="px-5 sm:px-6 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-emerald-900/10 flex items-center justify-center">
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 text-xs text-emerald-800 bg-white/80 rounded-full px-2 py-1">
                      {callPeer || "Remote"}
                    </div>
                    {!remoteVideoOn && (
                      <div className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-emerald-800">
                        {getInitials(callPeer)}
                      </div>
                    )}
                  </div>
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-emerald-900/10 flex items-center justify-center">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 text-xs text-emerald-800 bg-white/80 rounded-full px-2 py-1">
                      You
                    </div>
                    {!localVideoOn && (
                      <div className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-emerald-800">
                        {getInitials(user.username)}
                      </div>
                    )}
                    {callType === "video" && (
                      <button
                        type="button"
                        onClick={toggleCamera}
                        className="absolute top-2 right-2 text-xs px-3 py-1 rounded-full border border-emerald-200 text-emerald-800 bg-white/90"
                      >
                        {localVideoOn ? "Camera off" : "Camera on"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6 sm:py-6 space-y-4 bg-white/40">
              {!selectedConversationId && (
                <div className="h-full flex items-center justify-center text-emerald-700/70">
                  Select a user to start chatting.
                </div>
              )}

              {selectedConversationId &&
                selectedMessages.map((message) => {
                  const isOutgoing = message.sender?.username === user.username;

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
                        <p className="leading-relaxed">{message.body}</p>
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

            <div className="border-t border-white/70 bg-white/80 px-5 py-4 sm:px-6">
              <div className="flex gap-3">
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
                  className="rounded-2xl bg-emerald-600 text-white px-5 py-3 text-sm font-semibold disabled:bg-emerald-300"
                >
                  Send
                </button>
              </div>
              <div className="mt-2 text-xs text-emerald-600">
                Enter to send, Shift + Enter for new line.
              </div>
            </div>
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
              Incoming call
            </p>
            <h3 className="text-2xl font-semibold text-emerald-950 mt-3">
              {incomingOffer.from}
            </h3>
            <p className="text-sm text-emerald-700 mt-2">
              Accept the audio call?
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
