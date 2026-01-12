import 'package:flutter/material.dart';

class SoftCard extends StatelessWidget {
  const SoftCard({super.key, required this.child, this.padding = const EdgeInsets.all(18)});

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(22),
        boxShadow: const [
          BoxShadow(
            color: Color(0xFFE3EBF3),
            blurRadius: 24,
            offset: Offset(8, 8),
          ),
          BoxShadow(
            color: Color(0xFFFFFFFF),
            blurRadius: 18,
            offset: Offset(-6, -6),
          ),
        ],
      ),
      child: child,
    );
  }
}
