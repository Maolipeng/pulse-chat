class Message {
  final String id;
  final String conversationId;
  final String body;
  final String createdAt;
  final Map<String, dynamic>? metadata;
  final MessageSender? sender;
  final String plaintext;

  Message({
    required this.id,
    required this.conversationId,
    required this.body,
    required this.createdAt,
    required this.metadata,
    required this.sender,
    required this.plaintext,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id']?.toString() ?? '',
      conversationId: json['conversationId']?.toString() ?? '',
      body: json['body']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      metadata: json['metadata'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['metadata'])
          : null,
      sender: json['sender'] is Map<String, dynamic>
          ? MessageSender.fromJson(Map<String, dynamic>.from(json['sender']))
          : null,
      plaintext: json['plaintext']?.toString() ?? json['body']?.toString() ?? '',
    );
  }

  Message copyWith({String? plaintext}) {
    return Message(
      id: id,
      conversationId: conversationId,
      body: body,
      createdAt: createdAt,
      metadata: metadata,
      sender: sender,
      plaintext: plaintext ?? this.plaintext,
    );
  }
}

class MessageSender {
  final String id;
  final String username;

  MessageSender({required this.id, required this.username});

  factory MessageSender.fromJson(Map<String, dynamic> json) {
    return MessageSender(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
    );
  }
}
