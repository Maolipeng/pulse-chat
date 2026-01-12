import 'package:flutter/material.dart';

class SoftBackground extends StatelessWidget {
  const SoftBackground({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF2F6FA), Color(0xFFE9EFF5)],
        ),
      ),
      child: const Stack(
        children: [
          Positioned(
            top: -120,
            left: -140,
            child: _SoftGlow(size: 320, opacity: 0.5),
          ),
          Positioned(
            bottom: -160,
            right: -140,
            child: _SoftGlow(size: 360, opacity: 0.45),
          ),
        ],
      ),
    );
  }
}

class _SoftGlow extends StatelessWidget {
  const _SoftGlow({required this.size, required this.opacity});

  final double size;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [
            const Color(0xFFDDE7F0).withOpacity(opacity),
            const Color(0xFFF2F6FA).withOpacity(0),
          ],
        ),
      ),
    );
  }
}
