import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/chat_screen.dart';
import 'screens/login_screen.dart';
import 'services/socket_service.dart';
import 'state/auth_state.dart';
import 'state/call_state.dart';
import 'state/conversations_state.dart';
import 'theme.dart';

class WhatsAppFlutterApp extends StatelessWidget {
  const WhatsAppFlutterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthState()),
        ChangeNotifierProvider(create: (_) => SocketService()),
        ChangeNotifierProxyProvider2<AuthState, SocketService, CallState>(
          create: (context) => CallState(
            authState: context.read<AuthState>(),
            socketService: context.read<SocketService>(),
          ),
          update: (context, auth, socket, existing) =>
              existing ?? CallState(authState: auth, socketService: socket),
        ),
        ChangeNotifierProxyProvider2<AuthState, SocketService, ConversationsState>(
          create: (context) => ConversationsState(
            authState: context.read<AuthState>(),
            socketService: context.read<SocketService>(),
          ),
          update: (context, auth, socket, existing) =>
              existing ?? ConversationsState(authState: auth, socketService: socket),
        ),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.buildTheme(),
        home: const _RootRouter(),
      ),
    );
  }
}

class _RootRouter extends StatelessWidget {
  const _RootRouter();

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthState>(
      builder: (context, auth, _) {
        if (!auth.authChecked) {
          return const LoginScreen();
        }
        if (auth.token.isNotEmpty && auth.user != null) {
          return const ChatScreen();
        }
        return const LoginScreen();
      },
    );
  }
}
