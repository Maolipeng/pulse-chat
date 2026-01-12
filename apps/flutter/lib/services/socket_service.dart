import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../models/user.dart';
import 'app_config.dart';

class SocketService extends ChangeNotifier {
  io.Socket? _socket;
  String connectionStatus = 'offline';
  List<AppUser> usersOnline = [];

  io.Socket? get socket => _socket;

  void connect(String token) {
    disconnect();
    if (token.isEmpty) return;

    final socket = io.io(
      AppConfig.socketUrl(),
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableForceNew()
          .build(),
    );

    _socket = socket;
    socket.onConnect((_) {
      connectionStatus = 'online';
      notifyListeners();
    });
    socket.onDisconnect((_) {
      connectionStatus = 'offline';
      usersOnline = [];
      notifyListeners();
    });
    socket.on('users:update', (data) {
      final rawUsers = (data['users'] as List? ?? [])
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
      usersOnline = rawUsers
          .map((user) => AppUser.fromJson(user))
          .toList();
      notifyListeners();
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket = null;
    connectionStatus = 'offline';
    usersOnline = [];
    notifyListeners();
  }
}
