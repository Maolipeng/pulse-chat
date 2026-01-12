import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

class AppConfig {
  static const String _apiEnv = String.fromEnvironment('API_URL');
  static const String _socketEnv = String.fromEnvironment('SOCKET_URL');
  static const String _macApiEnv = String.fromEnvironment('MAC_API_URL');
  static const String _macSocketEnv = String.fromEnvironment('MAC_SOCKET_URL');

  static String apiBaseUrl() {
    if (kReleaseMode) {
      return 'https://chat-server.peakol.top';
    }
    if (_macApiEnv.isNotEmpty && Platform.isMacOS) return _macApiEnv;
    if (_apiEnv.isNotEmpty) return _apiEnv;
    if (kIsWeb) {
      final origin = Uri.base.origin;
      if (origin.contains('localhost') || origin.contains('127.0.0.1')) {
        return 'http://localhost:3001';
      }
      return origin;
    }
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3001';
    }
    if (Platform.isMacOS) {
      return 'http://127.0.0.1:3001';
    }
    return 'http://localhost:3001';
  }

  static String socketUrl() {
    if (_macSocketEnv.isNotEmpty && Platform.isMacOS) return _macSocketEnv;
    if (_socketEnv.isNotEmpty) return _socketEnv;
    return apiBaseUrl();
  }
}
