import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/user.dart';
import '../services/api_service.dart';

class AuthState extends ChangeNotifier {
  AuthState() {
    _bootstrap();
  }

  String authMode = 'login';
  String authUsername = '';
  String authPassword = '';
  String authError = '';
  bool authChecked = false;
  bool authOffline = false;
  String token = '';
  AppUser? user;

  ApiService get api => ApiService(token: token);

  Future<void> _bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final storedToken = prefs.getString('pulsechat-token');
    final storedUser = prefs.getString('pulsechat-user');
    if (storedToken != null && storedToken.isNotEmpty) {
      token = storedToken;
      if (storedUser != null) {
        try {
          final payload = jsonDecode(storedUser) as Map<String, dynamic>;
          if (payload['username'] != null) {
            user = AppUser.fromJson(payload);
          }
        } catch (_) {
          await prefs.remove('pulsechat-user');
        }
      }
      await _validateToken();
      return;
    }
    authChecked = true;
    notifyListeners();
  }

  Future<void> _validateToken() async {
    try {
      final payload = await api.getJson('/api/auth/me');
      final me = payload['user'] as Map<String, dynamic>;
      user = AppUser.fromJson(me);
      authOffline = false;
      authChecked = true;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('pulsechat-user', jsonEncode(user!.toJson()));
    } catch (_) {
      authOffline = true;
      authChecked = true;
    }
    notifyListeners();
  }

  void setAuthMode(String mode) {
    authMode = mode;
    notifyListeners();
  }

  void setAuthUsername(String value) {
    authUsername = value;
    notifyListeners();
  }

  void setAuthPassword(String value) {
    authPassword = value;
    notifyListeners();
  }

  Future<void> submitAuth() async {
    authError = '';
    notifyListeners();

    try {
      final payload = await api.postJson(
        '/api/auth/$authMode',
        {
          'username': authUsername.trim().toLowerCase(),
          'password': authPassword,
        },
      );
      token = payload['token']?.toString() ?? '';
      if (payload['user'] is Map<String, dynamic>) {
        user = AppUser.fromJson(Map<String, dynamic>.from(payload['user']));
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('pulsechat-token', token);
      if (user != null) {
        await prefs.setString('pulsechat-user', jsonEncode(user!.toJson()));
      }
      authChecked = true;
      authOffline = false;
    } on ApiException catch (error) {
      authError = error.message;
    } catch (_) {
      authError = 'Unable to authenticate.';
    }

    notifyListeners();
  }

  Future<void> logout() async {
    token = '';
    user = null;
    authChecked = true;
    authOffline = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('pulsechat-token');
    await prefs.remove('pulsechat-user');
    notifyListeners();
  }
}
