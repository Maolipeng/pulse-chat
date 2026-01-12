import 'package:flutter/material.dart';

String getInitials(String name) {
  if (name.trim().isEmpty) return '';
  final parts = name.trim().split(RegExp(r'\s+'));
  return parts.take(2).map((part) => part[0].toUpperCase()).join();
}

Color getAvatarColor(String name) {
  if (name.isEmpty) return const Color(0xFFE0F2E9);
  var hash = 0;
  for (final code in name.codeUnits) {
    hash = code + ((hash << 5) - hash);
  }
  final hue = (hash.abs() % 360).toDouble();
  return HSLColor.fromAHSL(1, hue, 0.6, 0.85).toColor();
}
