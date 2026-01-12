import 'dart:convert';
import 'dart:math';

import 'package:cryptography/cryptography.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/conversation.dart';
import '../models/message.dart';
import '../models/user.dart';
import 'api_service.dart';
import 'storage_keys.dart';

class MessagingService {
  MessagingService({required this.api, required this.user, required this.onNotice});

  final ApiService api;
  final AppUser user;
  final void Function(String) onNotice;

  final Ecdh _ecdh = Ecdh.p256(length: 32);
  EcKeyPair? _identityKeyPair;
  EcPublicKey? _identityPublicKey;

  Future<void> ensureIdentityKey() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(identityStorageKey(user.username));
    if (stored == null) {
      await _generateAndStoreIdentityKey(prefs);
      return;
    }
    try {
      final parsed = jsonDecode(stored) as Map<String, dynamic>;
      final publicKeyRaw = _parseJwk(parsed['publicKey']);
      final privateKeyRaw = _parseJwk(parsed['privateKey']);
      if (publicKeyRaw == null || privateKeyRaw == null) {
        await _generateAndStoreIdentityKey(prefs);
        return;
      }
      final publicKey = _importPublicKey(publicKeyRaw);
      final privateKey = _importPrivateKey(privateKeyRaw, publicKey);
      _identityKeyPair = privateKey;
      _identityPublicKey = publicKey;
    } catch (_) {
      await _generateAndStoreIdentityKey(prefs);
    }
  }

  Future<void> uploadIdentityKey() async {
    await ensureIdentityKey();
    if (_identityPublicKey == null) return;
    final jwk = _exportPublicJwk(_identityPublicKey!);
    await api.putJson('/api/keys', {'identityKey': jsonEncode(jwk)});
  }

  Future<Map<String, dynamic>?> getUserIdentityKey(String username) async {
    try {
      final payload = await api.getJson('/api/keys/$username');
      final raw = payload['identityKey']?.toString();
      return _parseJwk(raw);
    } catch (_) {
      return null;
    }
  }

  Future<ConversationState?> ensureConversationKey(Conversation conversation) async {
    await ensureIdentityKey();
    final cached = await _getConversationState(conversation.id);
    if (cached != null) return cached;
    if (conversation.isGroup) {
      return _loadGroupKey(conversation.id);
    }
    final other = conversation.members.firstWhere(
      (member) => member.username != user.username,
      orElse: () => ConversationMember(id: '', username: ''),
    );
    if (other.username.isEmpty) return null;
    return _deriveConversationKey(conversation, other.username);
  }

  Future<ConversationState?> _deriveConversationKey(
    Conversation conversation,
    String otherUsername,
  ) async {
    if (_identityKeyPair == null) return null;
    final otherIdentityRaw = await getUserIdentityKey(otherUsername);
    if (otherIdentityRaw == null) return null;
    final otherIdentity = _importPublicKey(otherIdentityRaw);
    final shared = await _deriveSharedSecret(_identityKeyPair!, otherIdentity);
    final salt = utf8.encode(conversation.id);
    final info = utf8.encode('pulsechat-direct');
    final key = await _hkdf(shared, salt, info, 32);
    final state = ConversationState(type: 'direct', key: _bytesToBase64(key));
    await _saveConversationState(conversation.id, state);
    return state;
  }

  Future<ConversationState?> _loadGroupKey(String conversationId) async {
    final payload = await api.getJson('/api/conversations/$conversationId/keys/me');
    final wrappedKey = payload['wrappedKey']?.toString();
    final iv = payload['iv']?.toString();
    if (wrappedKey == null || iv == null) return null;
    final creator = payload['createdBy'] as Map<String, dynamic>?;
    final creatorIdentityRaw = _parseJwk(creator?['identityKey']);
    if (creatorIdentityRaw == null || _identityKeyPair == null) return null;
    final creatorKey = _importPublicKey(creatorIdentityRaw);
    final salt = utf8.encode('wrap:$conversationId');
    final info = utf8.encode('pulsechat-group-wrap');
    final shared = await _deriveSharedSecret(_identityKeyPair!, creatorKey);
    final wrappingKey = await _hkdf(shared, salt, info, 32);
    final groupKeyBase64 = await _decryptAesGcm(wrappingKey, wrappedKey, iv);
    final state = ConversationState(type: 'group', key: groupKeyBase64);
    await _saveConversationState(conversationId, state);
    return state;
  }

  Future<void> distributeGroupKey(Conversation conversation) async {
    if (_identityKeyPair == null) return;
    final groupKeyBase64 = _bytesToBase64(_randomBytes(32));
    final keysPayload = <Map<String, dynamic>>[];

    for (final member in conversation.members) {
      final identityKeyRaw = await getUserIdentityKey(member.username);
      if (identityKeyRaw == null) continue;
      final memberKey = _importPublicKey(identityKeyRaw);
      final shared = await _deriveSharedSecret(_identityKeyPair!, memberKey);
      final salt = utf8.encode('wrap:${conversation.id}');
      final info = utf8.encode('pulsechat-group-wrap');
      final wrappingKey = await _hkdf(shared, salt, info, 32);
      final encrypted = await _encryptAesGcm(wrappingKey, groupKeyBase64);
      keysPayload.add({
        'userId': member.id,
        'wrappedKey': encrypted.ciphertext,
        'iv': encrypted.iv,
      });
    }

    await api.postJson('/api/conversations/${conversation.id}/keys', {
      'keys': keysPayload,
    });

    final state = ConversationState(type: 'group', key: groupKeyBase64);
    await _saveConversationState(conversation.id, state);
  }

  Future<EncryptedPayload?> encryptMessage(
    Conversation conversation,
    String plaintext, {
    Map<String, dynamic> extraMetadata = const {},
  }) async {
    final state = await ensureConversationKey(conversation);
    if (state == null) return null;
    final senderChain = await _getSenderChain(state, conversation.id, user.id);
    final counter = senderChain.counter;
    final messageKey = await _hkdf(
      _base64ToBytes(senderChain.chainKey),
      utf8.encode('msg:${conversation.id}'),
      utf8.encode('sender:${user.id}:$counter'),
      32,
    );
    final encrypted = await _encryptAesGcm(messageKey, plaintext);
    senderChain.counter = counter + 1;
    senderChain.chainKey = _bytesToBase64(await _sha256(_base64ToBytes(senderChain.chainKey)));
    await _saveConversationState(conversation.id, state);
    return EncryptedPayload(
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      metadata: {
        'type': conversation.isGroup ? 'group' : 'direct',
        'sender': user.id,
        'counter': counter,
        'iv': encrypted.iv,
        ...extraMetadata,
      },
    );
  }

  Future<String> decryptMessage(
    Conversation conversation,
    Message message, {
    bool retrying = false,
  }) async {
    final state = await ensureConversationKey(conversation);
    if (state == null) return '[Unable to decrypt]';
    final senderId = message.metadata?['sender']?.toString() ?? message.sender?.id;
    if (senderId == null || senderId.isEmpty) return '[Encrypted message]';
    final rawCounter = message.metadata?['counter'];
    final counter = rawCounter is int ? rawCounter : (rawCounter is num ? rawCounter.toInt() : null);
    if (counter == null) return '[Encrypted message]';
    final iv = message.metadata?['iv']?.toString();
    if (iv == null || iv.isEmpty) return '[Encrypted message]';

    final senderChain = await _getSenderChain(state, conversation.id, senderId);
    var chainKeyBytes = _base64ToBytes(senderChain.chainKey);
    while (senderChain.counter < counter) {
      chainKeyBytes = await _sha256(chainKeyBytes);
      senderChain.counter += 1;
    }
    final messageKey = await _hkdf(
      chainKeyBytes,
      utf8.encode('msg:${conversation.id}'),
      utf8.encode('sender:$senderId:$counter'),
      32,
    );
    try {
      final plaintext = await _decryptAesGcm(messageKey, message.body, iv);
      senderChain.counter += 1;
      senderChain.chainKey = _bytesToBase64(await _sha256(chainKeyBytes));
      await _saveConversationState(conversation.id, state);
      return plaintext;
    } catch (_) {
      if (retrying) return '[Unable to decrypt]';
      await _clearConversationState(conversation.id);
      final refreshed = await ensureConversationKey(conversation);
      if (refreshed == null) return '[Unable to decrypt]';
      return decryptMessage(conversation, message, retrying: true);
    }
  }

  Future<void> resetEncryptionState() async {
    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys();
    for (final key in keys) {
      if (key.startsWith('pulsechat:conv:${user.id}:')) {
        await prefs.remove(key);
      }
    }
  }

  Future<void> initialize() async {
    try {
      await ensureIdentityKey();
      await uploadIdentityKey();
    } catch (_) {
      onNotice('Unable to initialize encryption keys.');
    }
  }

  Future<EncryptionStatus> getEncryptionStatus() async {
    final hasLocal = await _hasLocalIdentityKey();
    final hasRemote = await hasServerIdentityKey();
    if (!hasLocal) {
      return const EncryptionStatus(
        ready: false,
        message: 'No local keys. Re-sync to generate.',
      );
    }
    if (!hasRemote) {
      return const EncryptionStatus(
        ready: false,
        message: 'Keys not uploaded. Re-sync to publish.',
      );
    }
    return const EncryptionStatus(ready: true, message: 'Encryption ready.');
  }

  Future<bool> hasServerIdentityKey() async {
    final key = await getUserIdentityKey(user.username);
    return key != null;
  }

  Future<bool> _hasLocalIdentityKey() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey(identityStorageKey(user.username));
  }

  Future<ConversationState?> _getConversationState(String conversationId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(conversationStorageKey(user.id, conversationId));
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return ConversationState.fromJson(decoded);
    } catch (_) {
      return null;
    }
  }

  Future<void> _saveConversationState(String conversationId, ConversationState state) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      conversationStorageKey(user.id, conversationId),
      jsonEncode(state.toJson()),
    );
  }

  Future<void> _clearConversationState(String conversationId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(conversationStorageKey(user.id, conversationId));
  }

  Future<void> _generateAndStoreIdentityKey(SharedPreferences prefs) async {
    final keyPair = await _ecdh.newKeyPair();
    final extracted = await keyPair.extract();
    _identityKeyPair = keyPair;
    _identityPublicKey = extracted.publicKey;

    final publicJwk = _exportPublicJwk(extracted.publicKey);
    final privateJwk = _exportPrivateJwk(extracted);

    await prefs.setString(
      identityStorageKey(user.username),
      jsonEncode({
        'publicKey': jsonEncode(publicJwk),
        'privateKey': jsonEncode(privateJwk),
      }),
    );
  }

  Map<String, dynamic>? _parseJwk(Object? raw) {
    if (raw == null) return null;
    if (raw is Map<String, dynamic>) return raw;
    if (raw is String) {
      try {
        return jsonDecode(raw) as Map<String, dynamic>;
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  EcPublicKey _importPublicKey(Map<String, dynamic> jwk) {
    final x = _normalizeP256Coordinate(_base64UrlDecode(jwk['x']?.toString() ?? ''));
    final y = _normalizeP256Coordinate(_base64UrlDecode(jwk['y']?.toString() ?? ''));
    return EcPublicKey(x: x, y: y, type: KeyPairType.p256);
  }

  EcKeyPair _importPrivateKey(Map<String, dynamic> jwk, EcPublicKey publicKey) {
    final d = _normalizeP256Coordinate(_base64UrlDecode(jwk['d']?.toString() ?? ''));
    return EcKeyPairData(
      d: d,
      x: publicKey.x,
      y: publicKey.y,
      type: KeyPairType.p256,
    );
  }

  Map<String, dynamic> _exportPublicJwk(EcPublicKey key) {
    final x = key.x;
    final y = key.y;
    return {
      'kty': 'EC',
      'crv': 'P-256',
      'x': _base64UrlEncode(x),
      'y': _base64UrlEncode(y),
      'key_ops': ['deriveBits'],
      'ext': true,
    };
  }

  Map<String, dynamic> _exportPrivateJwk(EcKeyPairData keyPair) {
    final publicJwk = _exportPublicJwk(keyPair.publicKey);
    return {
      ...publicJwk,
      'd': _base64UrlEncode(keyPair.d),
    };
  }

  Future<List<int>> _deriveSharedSecret(EcKeyPair privateKey, EcPublicKey publicKey) async {
    final isAndroid = defaultTargetPlatform == TargetPlatform.android;
    if (isAndroid) {
      final data = await privateKey.extract();
      final fixedKeyPair = EcKeyPairData(
        d: _ensureUnsignedBytes(data.d),
        x: _ensureUnsignedBytes(data.x),
        y: _ensureUnsignedBytes(data.y),
        type: KeyPairType.p256,
      );
      final fixedPublic = EcPublicKey(
        x: _ensureUnsignedBytes(publicKey.x),
        y: _ensureUnsignedBytes(publicKey.y),
        type: KeyPairType.p256,
      );
      final secret = await _ecdh.sharedSecretKey(
        keyPair: fixedKeyPair,
        remotePublicKey: fixedPublic,
      );
      return secret.extractBytes();
    }

    final secret = await _ecdh.sharedSecretKey(
      keyPair: privateKey,
      remotePublicKey: publicKey,
    );
    return secret.extractBytes();
  }

  Future<List<int>> _hkdf(List<int> input, List<int> salt, List<int> info, int length) async {
    final hkdf = Hkdf(hmac: Hmac.sha256(), outputLength: length);
    final secretKey = await hkdf.deriveKey(
      secretKey: SecretKey(input),
      nonce: salt,
      info: info,
    );
    return secretKey.extractBytes();
  }

  Future<List<int>> _sha256(List<int> data) async {
    final hash = await Sha256().hash(data);
    return hash.bytes;
  }

  List<int> _randomBytes(int length) {
    final random = Random.secure();
    return List<int>.generate(length, (_) => random.nextInt(256));
  }

  Future<_AesGcmPayload> _encryptAesGcm(List<int> rawKey, String plaintext) async {
    final nonce = _randomBytes(12);
    final algorithm = AesGcm.with256bits();
    final secretBox = await algorithm.encrypt(
      utf8.encode(plaintext),
      secretKey: SecretKey(rawKey),
      nonce: nonce,
    );
    final combined = [...secretBox.cipherText, ...secretBox.mac.bytes];
    return _AesGcmPayload(
      iv: _bytesToBase64(nonce),
      ciphertext: _bytesToBase64(combined),
    );
  }

  Future<String> _decryptAesGcm(List<int> rawKey, String ciphertext, String iv) async {
    final data = _base64ToBytes(ciphertext);
    if (data.length < 16) throw Exception('Invalid ciphertext');
    final cipherText = data.sublist(0, data.length - 16);
    final macBytes = data.sublist(data.length - 16);
    final algorithm = AesGcm.with256bits();
    final secretBox = SecretBox(
      cipherText,
      nonce: _base64ToBytes(iv),
      mac: Mac(macBytes),
    );
    final clear = await algorithm.decrypt(secretBox, secretKey: SecretKey(rawKey));
    return utf8.decode(clear);
  }

  String _bytesToBase64(List<int> bytes) => base64.encode(bytes);

  List<int> _base64ToBytes(String value) => base64.decode(value);

  String _base64UrlEncode(List<int> bytes) => base64Url.encode(bytes).replaceAll('=', '');

  List<int> _base64UrlDecode(String value) {
    var normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    while (normalized.length % 4 != 0) {
      normalized += '=';
    }
    return base64.decode(normalized);
  }

  List<int> _normalizeP256Coordinate(List<int> bytes) {
    if (bytes.length == 32) return bytes;
    if (bytes.length > 32) {
      // Drop leading zero padding if present.
      final trimmed = bytes.sublist(bytes.length - 32);
      return trimmed;
    }
    final padded = List<int>.filled(32 - bytes.length, 0);
    return [...padded, ...bytes];
  }

  List<int> _ensureUnsignedBytes(List<int> bytes) {
    if (bytes.isEmpty) return bytes;
    if (bytes.first & 0x80 == 0x80) {
      if (bytes.length == 33 && bytes.first == 0) return bytes;
      return [0, ...bytes];
    }
    return bytes;
  }
}

class ConversationState {
  ConversationState({required this.type, required this.key, Map<String, SenderChain>? senderChains})
      : senderChains = senderChains ?? {};

  final String type;
  final String key;
  final Map<String, SenderChain> senderChains;

  Map<String, dynamic> toJson() => {
        'type': type,
        'key': key,
        'senderChains': senderChains.map((key, value) => MapEntry(key, value.toJson())),
      };

  factory ConversationState.fromJson(Map<String, dynamic> json) {
    final chains = <String, SenderChain>{};
    final rawChains = json['senderChains'] as Map<String, dynamic>? ?? {};
    rawChains.forEach((key, value) {
      if (value is Map<String, dynamic>) {
        chains[key] = SenderChain.fromJson(value);
      }
    });
    return ConversationState(
      type: json['type']?.toString() ?? 'direct',
      key: json['key']?.toString() ?? '',
      senderChains: chains,
    );
  }
}

class SenderChain {
  SenderChain({required this.counter, required this.chainKey});

  int counter;
  String chainKey;

  Map<String, dynamic> toJson() => {
        'counter': counter,
        'chainKey': chainKey,
      };

  factory SenderChain.fromJson(Map<String, dynamic> json) {
    return SenderChain(
      counter: json['counter'] is int ? json['counter'] as int : 0,
      chainKey: json['chainKey']?.toString() ?? '',
    );
  }
}

class EncryptedPayload {
  EncryptedPayload({required this.ciphertext, required this.iv, required this.metadata});

  final String ciphertext;
  final String iv;
  final Map<String, dynamic> metadata;
}

class _AesGcmPayload {
  _AesGcmPayload({required this.ciphertext, required this.iv});

  final String ciphertext;
  final String iv;
}

class EncryptionStatus {
  const EncryptionStatus({required this.ready, required this.message});

  final bool ready;
  final String message;
}

extension _SenderChainExt on MessagingService {
  Future<SenderChain> _getSenderChain(
    ConversationState conversationState,
    String conversationId,
    String senderId,
  ) async {
    conversationState.senderChains.putIfAbsent(
      senderId,
      () => SenderChain(counter: 0, chainKey: ''),
    );
    final senderChain = conversationState.senderChains[senderId]!;
    if (senderChain.chainKey.isEmpty) {
      final derived = await _deriveSenderChain(conversationId, conversationState.key, senderId);
      senderChain.counter = derived.counter;
      senderChain.chainKey = derived.chainKey;
    }
    return senderChain;
  }

  Future<SenderChain> _deriveSenderChain(
    String conversationId,
    String groupKeyBase64,
    String senderId,
  ) async {
    final salt = utf8.encode('sender:$conversationId');
    final info = utf8.encode('pulsechat-sender:$senderId');
    final chainKey = await _hkdf(_base64ToBytes(groupKeyBase64), salt, info, 32);
    return SenderChain(counter: 0, chainKey: _bytesToBase64(chainKey));
  }
}
