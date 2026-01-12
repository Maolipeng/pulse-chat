import 'dart:convert';

import 'package:http/http.dart' as http;

import 'app_config.dart';

class ApiService {
  ApiService({required this.token});

  String? token;

  Future<Map<String, dynamic>> getJson(String path) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl()}$path');
    final response = await http.get(uri, headers: _headers());
    return _decode(response);
  }

  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl()}$path');
    final response = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> putJson(String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl()}$path');
    final response = await http.put(
      uri,
      headers: _headers(),
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Map<String, String> _headers() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (token != null && token!.isNotEmpty) {
      headers['Authorization'] = 'Bearer ${token!}';
    }
    return headers;
  }

  Map<String, dynamic> _decode(http.Response response) {
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(payload['error']?.toString() ?? 'Request failed');
    }
    return payload;
  }
}

class ApiException implements Exception {
  ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}
