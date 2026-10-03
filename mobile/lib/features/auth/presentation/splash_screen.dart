import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/kite_mark.dart';
import '../../../core/widgets/loaders.dart';

/// Shown while the stored session is restored. The router moves on automatically.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Scaffold(
      backgroundColor: AppColors.maroon900,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const KitePattern(),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const KiteLoader(size: 64, onDark: true),
                const SizedBox(height: 20),
                Text('GetPatang', style: t.textTheme.headlineMedium?.copyWith(color: AppColors.white)),
                const SizedBox(height: 6),
                Text(
                  'Shops · Tournaments · Community',
                  style: t.textTheme.bodyMedium?.copyWith(color: AppColors.maroon100),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
