"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
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
} from "../crypto";
import { conversationStorageKey, identityStorageKey } from "../utils/storage";

export default function useMessaging({ apiFetch, user, onNotice }) {
  const identityRef = useRef(null);
  const parseJwk = useCallback((value) => {
    if (!value) return null;
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (error) {
        return null;
      }
    }
    return value;
  }, []);

  const getConversationState = useCallback(
    (conversationId) => {
      if (!user) return null;
      return loadJson(conversationStorageKey(user.id, conversationId));
    },
    [user],
  );

  const saveConversationState = useCallback(
    (conversationId, state) => {
      if (!user) return;
      storeJson(conversationStorageKey(user.id, conversationId), state);
    },
    [user],
  );

  const clearConversationState = useCallback(
    (conversationId) => {
      if (!user) return;
      window.localStorage.removeItem(conversationStorageKey(user.id, conversationId));
    },
    [user],
  );

  const getUserIdentityKey = useCallback(
    async (username) => {
      try {
        const payload = await apiFetch(`/api/keys/${username}`);
        return payload.identityKey || null;
      } catch (error) {
        return null;
      }
    },
    [apiFetch],
  );

  const ensureIdentityKey = useCallback(async () => {
    if (!user) return;
    let stored = loadJson(identityStorageKey(user.username));
    if (!stored) {
      const keyPair = await generateIdentityKeyPair();
      const publicKey = await exportKey(keyPair.publicKey);
      const privateKey = await exportKey(keyPair.privateKey);
      stored = {
        publicKey: JSON.stringify(publicKey),
        privateKey: JSON.stringify(privateKey),
      };
      storeJson(identityStorageKey(user.username), stored);
    }
    const publicKeyJwk = parseJwk(stored.publicKey);
    const privateKeyJwk = parseJwk(stored.privateKey);
    if (!publicKeyJwk || !privateKeyJwk) {
      const keyPair = await generateIdentityKeyPair();
      const publicKey = await exportKey(keyPair.publicKey);
      const privateKey = await exportKey(keyPair.privateKey);
      stored = {
        publicKey: JSON.stringify(publicKey),
        privateKey: JSON.stringify(privateKey),
      };
      storeJson(identityStorageKey(user.username), stored);
      identityRef.current = {
        publicKey: await importPublicKey(publicKey),
        privateKey: await importPrivateKey(privateKey),
      };
      return;
    }
    identityRef.current = {
      publicKey: await importPublicKey(publicKeyJwk),
      privateKey: await importPrivateKey(privateKeyJwk),
    };
  }, [parseJwk, user]);

  const uploadIdentityKey = useCallback(async () => {
    if (!user) return;
    const stored = loadJson(identityStorageKey(user.username));
    if (!stored?.publicKey) return;
    const identityKey =
      typeof stored.publicKey === "string"
        ? stored.publicKey
        : JSON.stringify(stored.publicKey);
    if (!identityKey) return;
    await apiFetch("/api/keys", {
      method: "PUT",
      body: JSON.stringify({ identityKey }),
    });
  }, [apiFetch, user]);

  const deriveConversationKey = useCallback(
    async (conversation, otherUsername) => {
      if (!identityRef.current) return null;
      const otherIdentityRaw = await getUserIdentityKey(otherUsername);
      if (!otherIdentityRaw) return null;
      const otherIdentityJwk = parseJwk(otherIdentityRaw);
      if (!otherIdentityJwk) return null;
      const otherIdentity = await importPublicKey(otherIdentityJwk);
      const shared = await deriveBits(identityRef.current.privateKey, otherIdentity);
      const salt = new TextEncoder().encode(conversation.id);
      const info = new TextEncoder().encode("pulsechat-direct");
      const key = await hkdf(shared, salt, info, 32);
      const state = { type: "direct", key: bufferToBase64(key), senderChains: {} };
      saveConversationState(conversation.id, state);
      return state;
    },
    [getUserIdentityKey, parseJwk, saveConversationState],
  );

  const loadGroupKey = useCallback(
    async (conversationId) => {
      const payload = await apiFetch(`/api/conversations/${conversationId}/keys/me`);
      if (!payload?.wrappedKey || !payload?.iv) return null;
      if (!identityRef.current) return null;
      const creatorIdentityJwk = parseJwk(payload.createdBy?.identityKey);
      if (!creatorIdentityJwk) return null;
      const creatorPublicKey = await importPublicKey(creatorIdentityJwk);
      const salt = new TextEncoder().encode(`wrap:${conversationId}`);
      const info = new TextEncoder().encode("pulsechat-group-wrap");
      const shared = await deriveBits(identityRef.current.privateKey, creatorPublicKey);
      const wrappingKey = await hkdf(shared, salt, info, 32);
      const groupKeyBase64 = await decryptAesGcm(
        wrappingKey,
        payload.wrappedKey,
        payload.iv,
      );
      const state = { type: "group", key: groupKeyBase64, senderChains: {} };
      saveConversationState(conversationId, state);
      return state;
    },
    [apiFetch, parseJwk, saveConversationState],
  );

  const ensureConversationKey = useCallback(
    async (conversation) => {
      if (!identityRef.current) {
        await ensureIdentityKey();
      }
      const cached = getConversationState(conversation.id);
      if (cached) return cached;
      if (conversation.isGroup) {
        return loadGroupKey(conversation.id);
      }
      const other = conversation.members.find(
        (member) => member.username !== user.username,
      );
      if (!other) return null;
      return deriveConversationKey(conversation, other.username);
    },
    [
      deriveConversationKey,
      ensureIdentityKey,
      getConversationState,
      loadGroupKey,
      user?.username,
    ],
  );

  const deriveSenderChain = useCallback(async (conversationId, groupKeyBase64, senderId) => {
    const salt = new TextEncoder().encode(`sender:${conversationId}`);
    const info = new TextEncoder().encode(`pulsechat-sender:${senderId}`);
    const chainKey = await hkdf(base64ToBuffer(groupKeyBase64), salt, info, 32);
    return {
      counter: 0,
      chainKey: bufferToBase64(chainKey),
    };
  }, []);

  const getSenderChain = useCallback(
    async (conversationState, conversationId, senderId) => {
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
    },
    [deriveSenderChain],
  );

  const encryptMessage = useCallback(
    async (conversation, plaintext, extraMetadata = {}) => {
      const state = await ensureConversationKey(conversation);
      if (!state) return null;
      const senderChain = await getSenderChain(state, conversation.id, user.id);
      const counter = senderChain.counter;
      const messageKey = await hkdf(
        base64ToBuffer(senderChain.chainKey),
        new TextEncoder().encode(`msg:${conversation.id}`),
        new TextEncoder().encode(`sender:${user.id}:${counter}`),
        32,
      );
      const encrypted = await encryptAesGcm(messageKey, plaintext);
      senderChain.counter = counter + 1;
      senderChain.chainKey = bufferToBase64(await sha256(base64ToBuffer(senderChain.chainKey)));
      saveConversationState(conversation.id, state);
      return {
        ...encrypted,
        metadata: {
          type: conversation.isGroup ? "group" : "direct",
          sender: user.id,
          counter,
          iv: encrypted.iv,
          ...extraMetadata,
        },
      };
    },
    [ensureConversationKey, getSenderChain, saveConversationState, user?.id],
  );

  const decryptMessage = useCallback(
    async (conversation, message, retrying = false) => {
      const state = await ensureConversationKey(conversation);
      if (!state) return "[Unable to decrypt]";
      const senderId = message.metadata?.sender || message.senderId;
      if (!senderId) return "[Encrypted message]";
      const senderChain = await getSenderChain(state, conversation.id, senderId);
      let chainKeyBytes = new Uint8Array(base64ToBuffer(senderChain.chainKey));
      if (typeof message.metadata?.counter !== "number") {
        return "[Encrypted message]";
      }
      if (senderChain.counter > message.metadata.counter) {
        if (retrying) return "[Unable to decrypt]";
        clearConversationState(conversation.id);
        const refreshed = await ensureConversationKey(conversation);
        if (!refreshed) return "[Unable to decrypt]";
        return decryptMessage(conversation, message, true);
      }
      const iv = message.metadata?.iv || message.iv;
      if (!iv) {
        return "[Encrypted message]";
      }
      while (senderChain.counter < message.metadata.counter) {
        chainKeyBytes = await sha256(chainKeyBytes);
        senderChain.counter += 1;
      }
      const messageKey = await hkdf(
        chainKeyBytes,
        new TextEncoder().encode(`msg:${conversation.id}`),
        new TextEncoder().encode(`sender:${senderId}:${message.metadata.counter}`),
        32,
      );
      try {
        const plaintext = await decryptAesGcm(messageKey, message.body, iv);
        senderChain.counter += 1;
        senderChain.chainKey = bufferToBase64(await sha256(chainKeyBytes));
        saveConversationState(conversation.id, state);
        return plaintext;
      } catch (error) {
        if (retrying) return "[Unable to decrypt]";
        clearConversationState(conversation.id);
        const refreshed = await ensureConversationKey(conversation);
        if (!refreshed) return "[Unable to decrypt]";
        return decryptMessage(conversation, message, true);
      }
    },
    [
      clearConversationState,
      ensureConversationKey,
      getSenderChain,
      saveConversationState,
    ],
  );

  const distributeGroupKey = useCallback(
    async (conversation) => {
      if (!identityRef.current) return;

      const groupKeyBase64 = bufferToBase64(randomBytes(32));
      const keysPayload = [];

      for (const member of conversation.members) {
        const identityKeyRaw = await getUserIdentityKey(member.username);
        if (!identityKeyRaw) continue;
        const memberKeyJwk = parseJwk(identityKeyRaw);
        if (!memberKeyJwk) continue;
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
    },
    [apiFetch, getUserIdentityKey, parseJwk, saveConversationState],
  );

  const fileToDataUrl = useCallback(
    (file, onProgress) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadstart = () => onProgress?.(0);
        reader.onprogress = (event) => {
          if (!onProgress) return;
          if (event.lengthComputable && event.total > 0) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        reader.onload = () => {
          onProgress?.(100);
          resolve(reader.result);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      }),
    [],
  );

  const handleResetEncryption = useCallback(() => {
    if (!user) return;
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(`pulsechat:conv:${user.id}:`))
      .forEach((key) => window.localStorage.removeItem(key));
    onNotice?.("Encryption state reset. Select a conversation to re-sync.");
  }, [onNotice, user]);

  useEffect(() => {
    if (!user) return;

    const setup = async () => {
      try {
        await ensureIdentityKey();
        await uploadIdentityKey();
      } catch (error) {
        onNotice?.("Unable to initialize encryption keys.");
      }
    };

    setup();
  }, [ensureIdentityKey, uploadIdentityKey, onNotice, user]);

  return useMemo(
    () => ({
      clearConversationState,
      encryptMessage,
      decryptMessage,
      ensureConversationKey,
      distributeGroupKey,
      handleResetEncryption,
      fileToDataUrl,
      identityRef,
    }),
    [
      clearConversationState,
      decryptMessage,
      distributeGroupKey,
      encryptMessage,
      ensureConversationKey,
      fileToDataUrl,
      handleResetEncryption,
    ],
  );
}
