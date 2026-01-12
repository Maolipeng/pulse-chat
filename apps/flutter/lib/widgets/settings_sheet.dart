import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../state/conversations_state.dart';
import '../theme.dart';
import 'avatar_utils.dart';
import 'soft_card.dart';

class SettingsSheet extends StatelessWidget {
  const SettingsSheet({super.key});

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(20),
      child: SoftCard(
        child: Consumer2<AuthState, ConversationsState>(
          builder: (context, auth, conversations, _) {
            final user = auth.user;
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: getAvatarColor(user?.username ?? 'User'),
                      child: Text(
                        getInitials(user?.username ?? 'User'),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Settings',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  letterSpacing: 2.5,
                                  color: AppTheme.textMuted,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            user?.username ?? 'User',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () async {
                      await auth.logout();
                      if (context.mounted) {
                        Navigator.of(context).pop();
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppTheme.textMain,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                    child: const Text('Sign out'),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () async {
                      await conversations.resetEncryptionState();
                      if (context.mounted) {
                        Navigator.of(context).pop();
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFFF5E4),
                      foregroundColor: const Color(0xFF9B6B00),
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                    child: const Text('Reset encryption state'),
                  ),
                ),
                const SizedBox(height: 10),
                const SizedBox(height: 8),
                Text(
                  'Encryption status',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        letterSpacing: 2.5,
                        color: AppTheme.textMuted,
                      ),
                ),
                const SizedBox(height: 6),
                Text(
                  conversations.encryptionStatusMessage.isEmpty
                      ? 'Checking...'
                      : conversations.encryptionStatusMessage,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: conversations.encryptionReady
                            ? AppTheme.accentDark
                            : const Color(0xFFB33131),
                      ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: conversations.reinitializeEncryption,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppTheme.textMain,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                    child: const Text('Re-sync encryption keys'),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Calls are planned for the next iteration.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.textMuted,
                      ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
