import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/conversations_state.dart';
import '../theme.dart';
import 'soft_card.dart';

class ComposerModal extends StatelessWidget {
  const ComposerModal({super.key, required this.mode});

  final ComposerMode mode;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(20),
      child: SoftCard(
        child: Consumer<ConversationsState>(
          builder: (context, conversations, _) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      mode == ComposerMode.chat ? 'Start a chat' : 'Create a group',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (mode == ComposerMode.chat) ...[
                  TextField(
                    onChanged: conversations.setUserSearch,
                    decoration: const InputDecoration(
                      labelText: 'Search users',
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 180,
                    child: conversations.userResults.isEmpty
                        ? Center(
                            child: Text(
                              conversations.userSearch.isEmpty
                                  ? 'Type a username to search.'
                                  : 'No users found.',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppTheme.textMuted,
                                  ),
                            ),
                          )
                        : ListView.separated(
                            itemCount: conversations.userResults.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 10),
                            itemBuilder: (context, index) {
                              final user = conversations.userResults[index];
                              return TextButton(
                                onPressed: () async {
                                  await conversations.quickChat(user.username);
                                  if (context.mounted) {
                                    Navigator.of(context).pop();
                                  }
                                },
                                style: TextButton.styleFrom(
                                  backgroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 12,
                                  ),
                                ),
                                child: Align(
                                  alignment: Alignment.centerLeft,
                                  child: Text(user.username),
                                ),
                              );
                            },
                          ),
                  ),
                ] else ...[
                  TextField(
                    onChanged: conversations.setComposerTitle,
                    decoration: const InputDecoration(labelText: 'Group name'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    onChanged: conversations.setComposerMembers,
                    decoration: const InputDecoration(
                      labelText: 'Members (comma separated)',
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        final members = _parseMembers(conversations.composerMembers);
                        await conversations.createConversation(members, conversations.composerTitle);
                        if (context.mounted) {
                          Navigator.of(context).pop();
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.accent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                      ),
                      child: const Text('Create group'),
                    ),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  List<String> _parseMembers(String value) {
    return value
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .where((item) => item.isNotEmpty)
        .toList();
  }
}

enum ComposerMode { chat, group }
