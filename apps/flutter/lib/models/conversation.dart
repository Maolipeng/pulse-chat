import 'message.dart';
import 'user.dart';

class Conversation {
  final String id;
  final String? title;
  final bool isGroup;
  final List<ConversationMember> members;
  final Message? lastMessage;
  final int unread;
  final String preview;

  Conversation({
    required this.id,
    required this.title,
    required this.isGroup,
    required this.members,
    required this.lastMessage,
    required this.unread,
    required this.preview,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    final lastMessageJson = json['lastMessage'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(json['lastMessage'])
        : null;
    final lastMessage = lastMessageJson != null
        ? Message.fromJson(lastMessageJson)
        : null;
    final hasEncrypted = lastMessageJson?['metadata'] != null;
    return Conversation(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString(),
      isGroup: json['isGroup'] == true,
      members: (json['members'] as List? ?? [])
          .map((item) => ConversationMember.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
      lastMessage: lastMessage,
      unread: json['unread'] is int ? json['unread'] as int : 0,
      preview: hasEncrypted
          ? 'Encrypted message'
          : lastMessage?.body ?? '',
    );
  }

  String displayName(AppUser user) {
    if (isGroup) {
      return title?.isNotEmpty == true ? title! : 'Group chat';
    }
    return members
        .where((member) => member.username != user.username)
        .map((member) => member.username)
        .join(', ');
  }
}

class ConversationMember {
  final String id;
  final String username;
  final String? role;

  ConversationMember({required this.id, required this.username, this.role});

  factory ConversationMember.fromJson(Map<String, dynamic> json) {
    return ConversationMember(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      role: json['role']?.toString(),
    );
  }
}
