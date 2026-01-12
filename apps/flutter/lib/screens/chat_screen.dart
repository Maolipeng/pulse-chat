import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/call_state.dart';
import '../state/conversations_state.dart';
import '../theme.dart';
import '../widgets/chat_header.dart';
import '../widgets/chat_input.dart';
import '../widgets/chat_sidebar.dart';
import '../widgets/call_overlay.dart';
import '../widgets/composer_modal.dart';
import '../widgets/message_list.dart';
import '../widgets/settings_sheet.dart';
import '../widgets/soft_background.dart';
import '../widgets/soft_card.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  void _openComposer(ComposerMode mode) {
    showDialog(
      context: context,
      builder: (_) => ComposerModal(mode: mode),
    );
  }

  void _openSettings() {
    showDialog(
      context: context,
      builder: (_) => const SettingsSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const Positioned.fill(child: SoftBackground()),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final isWide = constraints.maxWidth > 980;
                return Padding(
                  padding: const EdgeInsets.all(18),
                  child: SoftCard(
                    padding: EdgeInsets.zero,
                    child: isWide
                        ? Row(
                            children: [
                              SizedBox(
                                width: 320,
                                child: ChatSidebar(
                                  onOpenComposer: () => _openComposer(ComposerMode.chat),
                                  onOpenSettings: _openSettings,
                                ),
                              ),
                              const VerticalDivider(width: 1, color: Color(0xFFE6EDF4)),
                              const Expanded(child: _ChatPanel()),
                            ],
                          )
                        : Consumer<ConversationsState>(
                            builder: (context, conversations, _) {
                              final showChat = conversations.selectedConversationId.isNotEmpty;
                              return showChat
                                  ? const _ChatPanel()
                                  : ChatSidebar(
                                      onOpenComposer: () => _openComposer(ComposerMode.chat),
                                      onOpenSettings: _openSettings,
                                    );
                            },
                          ),
                  ),
                );
              },
            ),
          ),
          const IncomingCallModal(),
          const CallOverlay(),
        ],
      ),
      floatingActionButton: LayoutBuilder(
        builder: (context, constraints) {
          final isWide = constraints.maxWidth > 980;
          return Consumer<ConversationsState>(
            builder: (context, conversations, _) {
              if (!isWide && conversations.selectedConversationId.isNotEmpty) {
                return const SizedBox.shrink();
              }
              return FloatingActionButton(
                onPressed: () => _openComposer(ComposerMode.group),
                backgroundColor: AppTheme.accent,
                child: const Icon(Icons.group_add_rounded),
              );
            },
          );
        },
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
    );
  }
}

class _ChatPanel extends StatelessWidget {
  const _ChatPanel();

  @override
  Widget build(BuildContext context) {
    return Consumer2<ConversationsState, CallState>(
      builder: (context, conversations, call, _) {
        return Column(
          children: [
            Row(
              children: [
                if (MediaQuery.of(context).size.width <= 980)
                  IconButton(
                    onPressed: conversations.clearSelection,
                    icon: const Icon(Icons.arrow_back_rounded),
                  ),
                const Expanded(child: ChatHeader()),
              ],
            ),
            if (conversations.notice.isNotEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: const BoxDecoration(
                  color: Color(0xFFE9F6F9),
                  border: Border(bottom: BorderSide(color: Color(0xFFD7EEF1))),
                ),
                child: Text(
                  conversations.notice,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.accentDark,
                      ),
                ),
              ),
            if (call.callNotice.isNotEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: const BoxDecoration(
                  color: Color(0xFFFFF5E4),
                  border: Border(bottom: BorderSide(color: Color(0xFFFFE2B8))),
                ),
                child: Text(
                  call.callNotice,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF9B6B00),
                      ),
                ),
              ),
            const Expanded(child: MessageList()),
            const ChatInput(),
          ],
        );
      },
    );
  }
}
