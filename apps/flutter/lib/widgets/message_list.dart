import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../state/conversations_state.dart';
import '../theme.dart';
import 'soft_card.dart';

class MessageList extends StatelessWidget {
  const MessageList({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer2<AuthState, ConversationsState>(
      builder: (context, auth, conversations, _) {
        if (conversations.selectedConversationId.isEmpty) {
          return Center(
            child: Text(
              'Select a user to start chatting.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.textMuted,
                  ),
            ),
          );
        }
        final messages = conversations.selectedMessages;
        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          itemCount: messages.length,
          itemBuilder: (context, index) {
            final message = messages[index];
            final isOutgoing = message.sender?.username == auth.user?.username;
            final isFile = message.metadata?['kind'] == 'file';
            return Align(
              alignment: isOutgoing ? Alignment.centerRight : Alignment.centerLeft,
              child: SoftCard(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isFile
                          ? '📎 ${message.metadata?['name'] ?? 'File'}'
                          : message.plaintext,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppTheme.textMain,
                          ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _formatTime(message.createdAt),
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: AppTheme.textMuted,
                              ),
                        ),
                        if (!isOutgoing && message.sender?.username != null) ...[
                          const SizedBox(width: 8),
                          Text(
                            message.sender!.username,
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: AppTheme.textMuted,
                                ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  String _formatTime(String timestamp) {
    if (timestamp.isEmpty) return '';
    final date = DateTime.tryParse(timestamp);
    if (date == null) return '';
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }
}
