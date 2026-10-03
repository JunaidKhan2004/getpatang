import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/kite_mark.dart';

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
                const KiteMark(size: 72, body: AppColors.white, wing: AppColors.maroon100),
                const SizedBox(height: 20),
                Text('Kite Platform', style: t.textTheme.headlineMedium?.copyWith(color: AppColors.white)),
                const SizedBox(height: 6),
                Text(
                  'Shops · Tournaments · Community',
                  style: t.textTheme.bodyMedium?.copyWith(color: AppColors.maroon100),
                ),
                const SizedBox(height: 40),
                const SizedBox.square(
                  dimension: 22,
                  child: CircularProgressIndicator(strokeWidth: 2.4, color: AppColors.white),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
