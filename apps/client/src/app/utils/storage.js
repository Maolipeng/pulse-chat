export const identityStorageKey = (username) => `pulsechat:identity:${username}`;
export const conversationStorageKey = (userId, conversationId) =>
  `pulsechat:conv:${userId}:${conversationId}`;
export const callHistoryStorageKey = (username) => `pulsechat:calls:${username}`;
