import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/call_state.dart';
import '../state/conversations_state.dart';
import '../services/socket_service.dart';
import '../theme.dart';
import 'avatar_utils.dart';
import 'soft_card.dart';

class ChatHeader extends StatelessWidget {
  const ChatHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer3<ConversationsState, SocketService, CallState>(
      builder: (context, conversations, socket, call, _) {
        final conversation = conversations.selectedConversationId.isEmpty
            ? null
            : conversations.selectedConversation;
        final name = conversation == null
            ? 'Pick a conversation'
            : conversation.isGroup
                ? conversation.title ?? 'Group chat'
                : conversations.otherMembers.map((member) => member.username).join(', ');

        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Color(0xFFE6EDF4))),
          ),
          child: Row(
            children: [
              SoftCard(
                padding: const EdgeInsets.all(10),
                child: CircleAvatar(
                  radius: 16,
                  backgroundColor: getAvatarColor(name),
                  child: Text(
                    getInitials(name),
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      conversation == null
                          ? 'Select a chat to start messaging'
                          : conversation.isGroup
                              ? '${conversation.members.length} members'
                              : socket.connectionStatus == 'online'
                                  ? 'online'
                                  : 'offline',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppTheme.textMuted,
                          ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: conversation == null ||
                        call.callState != 'idle' ||
                        socket.connectionStatus != 'online'
                    ? null
                    : () => call.startCall(conversations.callTarget, type: 'audio'),
                icon: const Icon(Icons.call_rounded),
                color: AppTheme.textMuted,
                tooltip: 'Voice call',
              ),
              IconButton(
                onPressed: conversation == null ||
                        call.callState != 'idle' ||
                        socket.connectionStatus != 'online'
                    ? null
                    : () => call.startCall(conversations.callTarget, type: 'video'),
                icon: const Icon(Icons.videocam_rounded),
                color: AppTheme.textMuted,
                tooltip: 'Video call',
              ),
            ],
          ),
        );
      },
    );
  }
}
