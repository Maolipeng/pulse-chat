String identityStorageKey(String username) => 'pulsechat:identity:$username';

String conversationStorageKey(String userId, String conversationId) =>
    'pulsechat:conv:$userId:$conversationId';

String callHistoryStorageKey(String username) => 'pulsechat:calls:$username';
