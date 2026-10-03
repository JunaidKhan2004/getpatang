import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

enum ToastKind { success, error, info }

void showToast(BuildContext context, String message, {ToastKind kind = ToastKind.info}) {
  final color = switch (kind) {
    ToastKind.success => AppColors.success,
    ToastKind.error => AppColors.danger,
    ToastKind.info => AppColors.maroon900,
  };
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
}

/// Primary button that shows a spinner and blocks taps while [loading].
class LoadingButton extends StatelessWidget {
  const LoadingButton({super.key, required this.label, required this.onPressed, this.loading = false});

  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) => FilledButton(
    onPressed: loading ? null : onPressed,
    child: loading
        ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.4))
        : Text(label),
  );
}

/// Centered message for empty or not-yet-built sections.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, required this.message, this.action});

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: t.colorScheme.primaryContainer,
              child: Icon(icon, size: 30, color: t.colorScheme.primary),
            ),
            const SizedBox(height: 16),
            Text(title, style: t.textTheme.titleLarge, textAlign: TextAlign.center),
            const SizedBox(height: 6),
            Text(message, style: t.textTheme.bodySmall, textAlign: TextAlign.center),
            if (action != null) ...[const SizedBox(height: 20), action!],
          ],
        ),
      ),
    );
  }
}
