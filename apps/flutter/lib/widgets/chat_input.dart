import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/conversations_state.dart';
import '../theme.dart';

class ChatInput extends StatefulWidget {
  const ChatInput({super.key});

  @override
  State<ChatInput> createState() => _ChatInputState();
}

class _ChatInputState extends State<ChatInput> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ConversationsState>(
      builder: (context, conversations, _) {
        final enabled = conversations.selectedConversationId.isNotEmpty;
        if (_controller.text != conversations.messageDraft) {
          _controller.text = conversations.messageDraft;
          _controller.selection = TextSelection.fromPosition(
            TextPosition(offset: _controller.text.length),
          );
        }
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: Color(0xFFE6EDF4))),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  enabled: enabled,
                  onChanged: conversations.setMessageDraft,
                  onSubmitted: (_) async {
                    await conversations.sendMessage();
                  },
                  decoration: InputDecoration(
                    hintText: enabled
                        ? 'Type a message'
                        : 'Select a conversation first',
                  ),
                ),
              ),
              const SizedBox(width: 12),
              ElevatedButton(
                onPressed: enabled
                    ? () async {
                        await conversations.sendMessage();
                      }
                    : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                  padding: const EdgeInsets.all(14),
                ),
                child: const Icon(Icons.send_rounded, size: 18),
              ),
            ],
          ),
        );
      },
    );
  }
}
