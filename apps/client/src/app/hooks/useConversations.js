"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function useConversations({
  apiFetch,
  socket,
  user,
  notificationsEnabled,
  onNotice,
  encryptMessage,
  decryptMessage,
  ensureConversationKey,
  distributeGroupKey,
  fileToDataUrl,
  messageInputRef,
  bottomRef,
}) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [messageDraft, setMessageDraft] = useState("");
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [composerTitle, setComposerTitle] = useState("");
  const [composerMembers, setComposerMembers] = useState("");

  const lastConversationKey = user?.username
    ? `pulsechat-last-conversation:${user.username}`
    : "";

  const conversationsRef = useRef([]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
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
        onNotice?.(error.message);
      }
    };

    if (user) {
      fetchConversations();
    }
  }, [apiFetch, onNotice, user]);

  useEffect(() => {
    if (user) return;
    setConversations([]);
    setSelectedConversationId("");
    setMessagesByConversation({});
    setMessageDraft("");
  }, [user]);


  useEffect(() => {
    if (!socket || !user) return;

    const handleMessage = async (payload) => {
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
    };

    const handleConversationCreated = async ({ conversationId }) => {
      try {
        const refreshed = await apiFetch("/api/conversations");
        setConversations(refreshed.conversations || []);
        socket.emit("conversation:join", { conversationId });
      } catch (error) {
        onNotice?.(error.message);
      }
    };

    socket.on("message:new", handleMessage);
    socket.on("conversation:created", handleConversationCreated);

    return () => {
      socket.off("message:new", handleMessage);
      socket.off("conversation:created", handleConversationCreated);
    };
  }, [apiFetch, decryptMessage, notificationsEnabled, onNotice, socket, user]);

  useEffect(() => {
    if (!userSearch || !user) {
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
  }, [apiFetch, user, userSearch]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bottomRef, messagesByConversation, selectedConversationId]);

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

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId),
    [conversations, selectedConversationId],
  );

  const selectedMessages = messagesByConversation[selectedConversationId] || [];

  const otherMembers = selectedConversation
    ? selectedConversation.members.filter((member) => member.username !== user?.username)
    : [];

  const isGroup = selectedConversation?.isGroup;

  const callTarget = !isGroup && otherMembers.length === 1 ? otherMembers[0].username : "";

  const handleSelectConversation = useCallback(
    async (conversation) => {
      setSelectedConversationId(conversation.id);
      setMessageDraft("");

      try {
        socket?.emit("conversation:join", { conversationId: conversation.id });
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

        socket?.emit("conversation:read", { conversationId: conversation.id });

        setConversations((prev) =>
          prev.map((item) =>
            item.id === conversation.id ? { ...item, unread: 0 } : item,
          ),
        );

        setTimeout(() => {
          messageInputRef?.current?.focus();
        }, 100);
      } catch (error) {
        onNotice?.(error.message);
      }
    },
    [
      apiFetch,
      decryptMessage,
      ensureConversationKey,
      messageInputRef,
      onNotice,
      socket,
    ],
  );

  useEffect(() => {
    if (!user || !lastConversationKey) return;
    if (typeof window === "undefined") return;
    if (selectedConversationId) {
      window.localStorage.setItem(lastConversationKey, selectedConversationId);
    } else {
      window.localStorage.removeItem(lastConversationKey);
    }
  }, [lastConversationKey, selectedConversationId, user]);

  useEffect(() => {
    if (!user || !lastConversationKey) return;
    if (selectedConversationId || conversations.length === 0) return;
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(lastConversationKey);
    if (!stored) return;
    const conversation = conversations.find((item) => item.id === stored);
    if (conversation) {
      handleSelectConversation(conversation);
    }
  }, [
    conversations,
    handleSelectConversation,
    lastConversationKey,
    selectedConversationId,
    user,
  ]);

  const pushLocalMessage = useCallback((conversationId, payload) => {
    setMessagesByConversation((prev) => {
      const updated = { ...prev };
      const thread = updated[conversationId] || [];
      updated[conversationId] = [...thread, payload];
      return updated;
    });
  }, []);

  const handleSend = useCallback(async () => {
    const conversation = selectedConversation;
    if (!conversation) return;
    const trimmed = messageDraft.trim();
    if (!trimmed) return;

    try {
      const encrypted = await encryptMessage(conversation, trimmed);
      if (!encrypted) {
        onNotice?.("Unable to encrypt message. Please try again.");
        return;
      }

      if (socket) {
        socket.emit("message:send", {
          conversationId: selectedConversationId,
          body: encrypted.ciphertext,
          metadata: encrypted.metadata,
        });
        setMessageDraft("");
        return;
      }

      const payload = await apiFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: selectedConversationId,
          body: encrypted.ciphertext,
          iv: encrypted.iv,
          metadata: encrypted.metadata,
        }),
      });

      pushLocalMessage(conversation.id, {
        ...payload.message,
        plaintext: trimmed,
      });

      setMessageDraft("");
    } catch (error) {
      onNotice?.(error.message);
    }
  }, [
    apiFetch,
    encryptMessage,
    messageDraft,
    onNotice,
    pushLocalMessage,
    selectedConversation,
    selectedConversationId,
    socket,
  ]);

  const handleSendFile = useCallback(
    async (file) => {
      if (!file) return;
      const conversation = selectedConversation;
      if (!conversation) return;

      try {
        const dataUrl = await fileToDataUrl(file);
        const encrypted = await encryptMessage(conversation, dataUrl, {
          kind: "file",
          name: file.name,
          size: file.size,
          mime: file.type,
        });
        if (!encrypted) {
          onNotice?.("Unable to encrypt file. Please try again.");
          return;
        }

        if (socket) {
          socket.emit("message:send", {
            conversationId: selectedConversationId,
            body: encrypted.ciphertext,
            metadata: encrypted.metadata,
          });
          return;
        }

        const payload = await apiFetch("/api/messages", {
          method: "POST",
          body: JSON.stringify({
            conversationId: selectedConversationId,
            body: encrypted.ciphertext,
            iv: encrypted.iv,
            metadata: encrypted.metadata,
          }),
        });

        pushLocalMessage(conversation.id, {
          ...payload.message,
          plaintext: dataUrl,
        });
      } catch (error) {
        onNotice?.(error.message);
      }
    },
    [
      apiFetch,
      encryptMessage,
      fileToDataUrl,
      onNotice,
      pushLocalMessage,
      selectedConversation,
      selectedConversationId,
      socket,
    ],
  );

  const handleCreateConversation = useCallback(
    async (members, title) => {
      try {
        const payload = await apiFetch("/api/conversations", {
          method: "POST",
          body: JSON.stringify({ members, title }),
        });
        const refreshed = await apiFetch("/api/conversations");
        setConversations(refreshed.conversations || []);
        if (payload?.id) {
          setSelectedConversationId(payload.id);
          const created = refreshed.conversations?.find((conv) => conv.id === payload.id);
          if (created?.isGroup) {
            await distributeGroupKey(created);
          }
        }
      } catch (error) {
        onNotice?.(error.message);
      }
    },
    [apiFetch, distributeGroupKey, onNotice],
  );

  const handleQuickChat = useCallback(
    (username) => {
      handleCreateConversation([username], "");
    },
    [handleCreateConversation],
  );

  return {
    conversations,
    filteredConversations,
    selectedConversationId,
    setSelectedConversationId,
    selectedConversation,
    selectedMessages,
    otherMembers,
    isGroup,
    callTarget,
    messagesByConversation,
    messageDraft,
    setMessageDraft,
    handleSelectConversation,
    handleSend,
    handleSendFile,
    handleCreateConversation,
    handleQuickChat,
    search,
    setSearch,
    userSearch,
    setUserSearch,
    userResults,
    composerTitle,
    setComposerTitle,
    composerMembers,
    setComposerMembers,
  };
}
