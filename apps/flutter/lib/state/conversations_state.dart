import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../models/conversation.dart';
import '../models/message.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/messaging_service.dart';
import '../services/socket_service.dart';
import 'auth_state.dart';

class ConversationsState extends ChangeNotifier {
  ConversationsState({required this.authState, required this.socketService}) {
    authState.addListener(_handleAuthChange);
    socketService.addListener(_handleSocketChange);
    _handleAuthChange();
  }

  final AuthState authState;
  final SocketService socketService;

  List<Conversation> conversations = [];
  String selectedConversationId = '';
  Map<String, List<Message>> messagesByConversation = {};
  String messageDraft = '';
  String search = '';
  String userSearch = '';
  List<AppUser> userResults = [];
  String composerTitle = '';
  String composerMembers = '';
  String notice = '';
  bool encryptionReady = false;
  String encryptionStatusMessage = '';

  io.Socket? _socket;
  MessagingService? _messaging;
  void Function(dynamic)? _messageHandler;
  void Function(dynamic)? _conversationHandler;
  Timer? _userSearchDebounce;

  List<Conversation> get filteredConversations {
    if (search.isEmpty) return conversations;
    final term = search.toLowerCase();
    return conversations.where((conversation) {
      final name = conversation.displayName(authState.user ?? AppUser(id: '', username: ''));
      return name.toLowerCase().contains(term);
    }).toList();
  }

  Conversation? get selectedConversation {
    return conversations.firstWhere(
      (item) => item.id == selectedConversationId,
      orElse: () => Conversation(
        id: '',
        title: null,
        isGroup: false,
        members: const [],
        lastMessage: null,
        unread: 0,
        preview: '',
      ),
    );
  }

  List<Message> get selectedMessages {
    return messagesByConversation[selectedConversationId] ?? [];
  }

  List<AppUser> get otherMembers {
    final user = authState.user;
    if (user == null || selectedConversationId.isEmpty) return [];
    final conversation = conversations.firstWhere(
      (item) => item.id == selectedConversationId,
      orElse: () => Conversation(
        id: '',
        title: null,
        isGroup: false,
        members: const [],
        lastMessage: null,
        unread: 0,
        preview: '',
      ),
    );
    return conversation.members
        .where((member) => member.username != user.username)
        .map((member) => AppUser(id: member.id, username: member.username))
        .toList();
  }

  bool get isGroup =>
      selectedConversationId.isNotEmpty &&
      conversations.firstWhere(
        (item) => item.id == selectedConversationId,
        orElse: () => Conversation(
          id: '',
          title: null,
          isGroup: false,
          members: const [],
          lastMessage: null,
          unread: 0,
          preview: '',
        ),
      ).isGroup;

  String get callTarget {
    if (isGroup) return '';
    return otherMembers.isNotEmpty ? otherMembers.first.username : '';
  }

  void setSearch(String value) {
    search = value;
    notifyListeners();
  }

  void setMessageDraft(String value) {
    messageDraft = value;
    notifyListeners();
  }

  void setUserSearch(String value) {
    userSearch = value;
    _userSearchDebounce?.cancel();
    _userSearchDebounce = Timer(const Duration(milliseconds: 200), _fetchUsers);
    notifyListeners();
  }

  void setComposerTitle(String value) {
    composerTitle = value;
    notifyListeners();
  }

  void setComposerMembers(String value) {
    composerMembers = value;
    notifyListeners();
  }

  void setNotice(String value) {
    notice = value;
    notifyListeners();
  }

  Future<void> _fetchConversations() async {
    if (authState.user == null || authState.token.isEmpty) return;
    try {
      final payload = await authState.api.getJson('/api/conversations');
      final list = (payload['conversations'] as List? ?? [])
          .map((item) => Conversation.fromJson(Map<String, dynamic>.from(item)))
          .toList();
      conversations = list;
      await _messaging?.initialize();
      await refreshEncryptionStatus();
      await _restoreLastConversation();
      notifyListeners();
    } catch (error) {
      setNotice(error.toString());
    }
  }

  Future<void> _fetchUsers() async {
    if (userSearch.isEmpty || authState.token.isEmpty) {
      userResults = [];
      notifyListeners();
      return;
    }
    try {
      final payload = await authState.api.getJson('/api/users?search=$userSearch');
      userResults = (payload['users'] as List? ?? [])
          .map((item) => AppUser.fromJson(Map<String, dynamic>.from(item)))
          .toList();
    } catch (_) {
      userResults = [];
    }
    notifyListeners();
  }

  Future<void> selectConversation(Conversation conversation) async {
    selectedConversationId = conversation.id;
    messageDraft = '';
    notifyListeners();

    _socket?.emit('conversation:join', {'conversationId': conversation.id});

    try {
      final keyState = await _messaging?.ensureConversationKey(conversation);
      if (keyState == null) {
        setNotice(
          'Encryption keys missing. Ask the other user to log in, then re-sync encryption.',
        );
        await refreshEncryptionStatus();
        return;
      }
      final payload = await authState.api
          .getJson('/api/conversations/${conversation.id}/messages');
      final messages = (payload['messages'] as List? ?? [])
          .map((item) => _mapMessage(Map<String, dynamic>.from(item)))
          .toList();
      if (_messaging != null) {
        for (var i = 0; i < messages.length; i += 1) {
          final message = messages[i];
          if (message.metadata != null) {
            final plaintext = await _messaging!.decryptMessage(conversation, message);
            messages[i] = message.copyWith(plaintext: plaintext);
          }
        }
      }
      messagesByConversation[conversation.id] = messages;
      await authState.api.postJson('/api/conversations/${conversation.id}/read', {});
      _socket?.emit('conversation:read', {'conversationId': conversation.id});
      _updateConversationUnread(conversation.id, 0);
      await _storeLastConversation(conversation.id);
    } catch (error) {
      setNotice(error.toString());
    }
    notifyListeners();
  }

  Future<void> sendMessage() async {
    final conversation = conversations.firstWhere(
      (item) => item.id == selectedConversationId,
      orElse: () => Conversation(
        id: '',
        title: null,
        isGroup: false,
        members: const [],
        lastMessage: null,
        unread: 0,
        preview: '',
      ),
    );
    if (conversation.id.isEmpty) return;
    final trimmed = messageDraft.trim();
    if (trimmed.isEmpty) return;

    try {
      final encrypted = _messaging != null
          ? await _messaging!.encryptMessage(conversation, trimmed)
          : null;

      if (encrypted == null) {
        setNotice('Unable to encrypt message. Please try again.');
        return;
      }

      if (_socket != null && socketService.connectionStatus == 'online') {
        _socket?.emit('message:send', {
          'conversationId': conversation.id,
          'body': encrypted.ciphertext,
          'metadata': encrypted.metadata,
        });
        messageDraft = '';
        notifyListeners();
        return;
      }

      final payload = await authState.api.postJson('/api/messages', {
        'conversationId': conversation.id,
        'body': encrypted.ciphertext,
        'iv': encrypted.iv,
        'metadata': encrypted.metadata,
      });
      final message = _mapMessage(Map<String, dynamic>.from(payload['message']));
      _pushMessage(conversation.id, message.copyWith(plaintext: trimmed));
      messageDraft = '';
      notifyListeners();
    } catch (error) {
      setNotice(error.toString());
    }
  }

  Future<void> createConversation(List<String> members, String title) async {
    try {
      final payload = await authState.api.postJson('/api/conversations', {
        'members': members,
        'title': title,
      });
      await _fetchConversations();
      if (payload['id'] != null) {
        final created = conversations.firstWhere(
          (item) => item.id == payload['id'].toString(),
          orElse: () => conversations.first,
        );
        if (created.isGroup) {
          await _messaging?.distributeGroupKey(created);
        }
        await selectConversation(created);
      }
      composerMembers = '';
      composerTitle = '';
      userSearch = '';
      userResults = [];
    } catch (error) {
      setNotice(error.toString());
    }
  }

  Future<void> quickChat(String username) async {
    await createConversation([username], '');
  }

  void clearSelection() {
    selectedConversationId = '';
    notifyListeners();
  }

  Future<void> resetEncryptionState() async {
    if (_messaging == null) return;
    await _messaging!.resetEncryptionState();
    setNotice('Encryption state reset. Select a conversation to re-sync.');
    await refreshEncryptionStatus();
  }

  Future<void> refreshEncryptionStatus() async {
    if (_messaging == null) return;
    final status = await _messaging!.getEncryptionStatus();
    encryptionReady = status.ready;
    encryptionStatusMessage = status.message;
    notifyListeners();
  }

  Future<void> reinitializeEncryption() async {
    if (_messaging == null) return;
    await _messaging!.initialize();
    await refreshEncryptionStatus();
    setNotice('Encryption keys refreshed.');
  }

  Message _mapMessage(Map<String, dynamic> payload) {
    final metadata = payload['metadata'];
    final plaintext = metadata == null ? payload['body']?.toString() ?? '' : '[Encrypted message]';
    return Message.fromJson({...payload, 'plaintext': plaintext});
  }

  void _pushMessage(String conversationId, Message message) {
    final thread = messagesByConversation[conversationId] ?? [];
    messagesByConversation[conversationId] = [...thread, message];
  }

  void _updateConversationUnread(String conversationId, int unread) {
    conversations = conversations
        .map((item) => item.id == conversationId
            ? Conversation(
                id: item.id,
                title: item.title,
                isGroup: item.isGroup,
                members: item.members,
                lastMessage: item.lastMessage,
                unread: unread,
                preview: item.preview,
              )
            : item)
        .toList();
  }

  void _handleAuthChange() {
    if (authState.token.isEmpty) {
      socketService.disconnect();
      conversations = [];
      selectedConversationId = '';
      messagesByConversation = {};
      _messaging = null;
      notifyListeners();
      return;
    }
    socketService.connect(authState.token);
    if (authState.user != null) {
      _messaging = MessagingService(
        api: authState.api,
        user: authState.user!,
        onNotice: setNotice,
      );
      refreshEncryptionStatus();
    }
    _fetchConversations();
  }

  void _handleSocketChange() {
    final socket = socketService.socket;
    if (_socket == socket) return;

    if (_socket != null && _messageHandler != null) {
      _socket?.off('message:new', _messageHandler);
    }
    if (_socket != null && _conversationHandler != null) {
      _socket?.off('conversation:created', _conversationHandler);
    }

    _socket = socket;
    if (_socket == null) return;

    _messageHandler = (payload) {
      if (payload is! Map) return;
      _handleIncomingMessage(Map<String, dynamic>.from(payload));
    };

    _conversationHandler = (_) async {
      await _fetchConversations();
    };

    _socket?.on('message:new', _messageHandler!);
    _socket?.on('conversation:created', _conversationHandler!);
  }

  Future<void> _storeLastConversation(String conversationId) async {
    final user = authState.user;
    if (user == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('pulsechat-last-conversation:${user.username}', conversationId);
  }

  Future<void> _restoreLastConversation() async {
    final user = authState.user;
    if (user == null || conversations.isEmpty || selectedConversationId.isNotEmpty) {
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString('pulsechat-last-conversation:${user.username}');
    if (stored == null) return;
    final match = conversations.firstWhere(
      (item) => item.id == stored,
      orElse: () => conversations.first,
    );
    if (match.id.isNotEmpty) {
      await selectConversation(match);
    }
  }

  @override
  void dispose() {
    authState.removeListener(_handleAuthChange);
    socketService.removeListener(_handleSocketChange);
    _userSearchDebounce?.cancel();
    super.dispose();
  }

  Future<void> _handleIncomingMessage(Map<String, dynamic> payload) async {
    final message = _mapMessage(payload);
    String plaintext = message.plaintext;
    final conversation = conversations.firstWhere(
      (item) => item.id == message.conversationId,
      orElse: () => Conversation(
        id: '',
        title: null,
        isGroup: false,
        members: const [],
        lastMessage: null,
        unread: 0,
        preview: '',
      ),
    );

    if (message.metadata != null && conversation.id.isNotEmpty && _messaging != null) {
      try {
        plaintext = await _messaging!.decryptMessage(conversation, message);
      } catch (_) {
        plaintext = '[Unable to decrypt]';
      }
    }

    final enriched = message.copyWith(plaintext: plaintext);
    _pushMessage(message.conversationId, enriched);
    conversations = conversations.map((item) {
      if (item.id != message.conversationId) {
        if (enriched.sender?.username != authState.user?.username) {
          return Conversation(
            id: item.id,
            title: item.title,
            isGroup: item.isGroup,
            members: item.members,
            lastMessage: enriched,
            unread: item.unread + 1,
            preview: plaintext,
          );
        }
        return item;
      }
      return Conversation(
        id: item.id,
        title: item.title,
        isGroup: item.isGroup,
        members: item.members,
        lastMessage: enriched,
        unread: item.unread,
        preview: plaintext,
      );
    }).toList();
    notifyListeners();
  }
}
