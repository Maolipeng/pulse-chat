import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';
import '../widgets/soft_background.dart';
import '../widgets/soft_card.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const Positioned.fill(child: SoftBackground()),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Consumer<AuthState>(
                    builder: (context, auth, _) {
                      if (!auth.authChecked) {
                        return const SoftCard(
                          child: _LoadingPanel(),
                        );
                      }

                      return SoftCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'PulseChat',
                              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                                    color: AppTheme.accentDark,
                                    letterSpacing: 3,
                                  ),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              auth.authMode == 'login'
                                  ? 'Welcome back'
                                  : 'Create your account',
                              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              auth.authMode == 'login'
                                  ? 'Sign in to continue your conversations.'
                                  : 'Pick a username and password to get started.',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppTheme.textMuted,
                                  ),
                            ),
                            if (auth.authOffline) ...[
                              const SizedBox(height: 16),
                              _NoticeCard(
                                text:
                                    'Server unreachable. You can retry login or wait for reconnection.',
                                tone: _NoticeTone.warn,
                              ),
                            ],
                            if (auth.authError.isNotEmpty) ...[
                              const SizedBox(height: 16),
                              _NoticeCard(text: auth.authError, tone: _NoticeTone.error),
                            ],
                            const SizedBox(height: 20),
                            TextField(
                              onChanged: auth.setAuthUsername,
                              decoration: const InputDecoration(labelText: 'Username'),
                            ),
                            const SizedBox(height: 14),
                            TextField(
                              onChanged: auth.setAuthPassword,
                              obscureText: true,
                              decoration: const InputDecoration(labelText: 'Password'),
                            ),
                            const SizedBox(height: 20),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: auth.submitAuth,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.accent,
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                ),
                                child: Text(
                                  auth.authMode == 'login'
                                      ? 'Sign in'
                                      : 'Create account',
                                ),
                              ),
                            ),
                            const SizedBox(height: 10),
                            SizedBox(
                              width: double.infinity,
                              child: TextButton(
                                onPressed: () => auth.setAuthMode(
                                  auth.authMode == 'login' ? 'register' : 'login',
                                ),
                                child: Text(
                                  auth.authMode == 'login'
                                      ? 'Need an account? Register'
                                      : 'Have an account? Sign in',
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LoadingPanel extends StatelessWidget {
  const _LoadingPanel();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          'PulseChat',
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: AppTheme.accentDark,
                letterSpacing: 3,
              ),
        ),
        const SizedBox(height: 16),
        Text(
          'Checking your session...',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppTheme.textMuted,
              ),
        ),
      ],
    );
  }
}

enum _NoticeTone { warn, error }

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({required this.text, required this.tone});

  final String text;
  final _NoticeTone tone;

  @override
  Widget build(BuildContext context) {
    final color = tone == _NoticeTone.warn ? const Color(0xFFFFF6DB) : const Color(0xFFFFE7E7);
    final border = tone == _NoticeTone.warn ? const Color(0xFFFFE3A1) : const Color(0xFFF4B3B3);
    final textColor = tone == _NoticeTone.warn ? const Color(0xFF9B6B00) : const Color(0xFFB33131);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: border),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: textColor),
      ),
    );
  }
}
