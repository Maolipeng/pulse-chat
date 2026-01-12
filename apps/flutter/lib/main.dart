import 'package:cryptography/cryptography.dart';
import 'package:cryptography_flutter/cryptography_flutter.dart';
import 'package:flutter/material.dart';

import 'app.dart';

void main() {
  Cryptography.instance = FlutterCryptography();
  runApp(const WhatsAppFlutterApp());
}
