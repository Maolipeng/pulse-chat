import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/conversation.dart';
import '../state/auth_state.dart';
import '../state/conversations_state.dart';
import '../services/socket_service.dart';
import '../theme.dart';
import 'avatar_utils.dart';
import 'soft_card.dart';

class ChatSidebar extends StatelessWidget {
  const ChatSidebar({
    super.key,
    required this.onOpenComposer,
    required this.onOpenSettings,
  });

  final VoidCallback onOpenComposer;
  final VoidCallback onOpenSettings;

  @override
  Widget build(BuildContext context) {
    return Consumer3<AuthState, ConversationsState, SocketService>(
      builder: (context, auth, conversations, socket, _) {
        final user = auth.user;
        if (user == null) {
          return const SizedBox.shrink();
        }

        return Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFFEAF5F3), Color(0xFFF6FAFD)],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: getAvatarColor(user.username),
                        child: Text(
                          getInitials(user.username),
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Online',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  letterSpacing: 2.5,
                                  color: AppTheme.accentDark,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            user.username,
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  SoftCard(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Text(
                      socket.connectionStatus == 'online' ? 'connected' : 'offline',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: socket.connectionStatus == 'online'
                                ? const Color(0xFF4BB5C7)
                                : const Color(0xFFB18500),
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: onOpenComposer,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppTheme.accentDark,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                      ),
                      child: const Text('New chat'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  IconButton(
                    onPressed: onOpenSettings,
                    icon: const Icon(Icons.settings_rounded),
                    color: AppTheme.textMuted,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                onChanged: conversations.setSearch,
                decoration: const InputDecoration(
                  hintText: 'Search',
                  prefixIcon: Icon(Icons.search_rounded),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Conversations',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      letterSpacing: 2.5,
                      color: AppTheme.textMuted,
                    ),
              ),
              const SizedBox(height: 10),
              Expanded(
                child: conversations.filteredConversations.isEmpty
                    ? Center(
                        child: Text(
                          'No conversations yet.',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppTheme.textMuted,
                              ),
                        ),
                      )
                    : ListView.separated(
                        itemCount: conversations.filteredConversations.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final item = conversations.filteredConversations[index];
                          final name = item.displayName(user);
                          final active = item.id == conversations.selectedConversationId;
                          return _ConversationTile(
                            conversation: item,
                            name: name,
                            active: active,
                            onTap: () => conversations.selectConversation(item),
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({
    required this.conversation,
    required this.name,
    required this.active,
    required this.onTap,
  });

  final Conversation conversation;
  final String name;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: onTap,
      child: SoftCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: getAvatarColor(name.isEmpty ? 'Chat' : name),
              child: Text(
                getInitials(name.isEmpty ? 'Chat' : name),
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name.isEmpty ? 'Untitled' : name,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    conversation.preview.isNotEmpty
                        ? conversation.preview
                        : 'Start a new chat',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.textMuted,
                        ),
                  ),
                ],
              ),
            ),
            if (conversation.unread > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.accent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  conversation.unread.toString(),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            if (active)
              const Padding(
                padding: EdgeInsets.only(left: 8),
                child: Icon(Icons.circle, size: 10, color: AppTheme.accentDark),
              ),
          ],
        ),
      ),
    );
  }
}
