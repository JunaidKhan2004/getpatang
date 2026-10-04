import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/kite_mark.dart';
import 'onboarding_store.dart';
import '../../core/i18n/i18n.dart';

class _Slide {
  const _Slide(this.icon, this.title, this.body);
  final IconData icon;
  final String title;
  final String body;
}

const _slides = [
  _Slide(
    Icons.storefront_outlined,
    'Kites from trusted shops',
    'Browse kites and accessories from verified sellers across Pakistan, and follow your favourite shops.',
  ),
  _Slide(
    Icons.emoji_events_outlined,
    'Organised, safe tournaments',
    'Register for approved events, follow live matches and climb the city and national rankings.',
  ),
  _Slide(
    Icons.groups_outlined,
    'A community of flyers',
    'Share photos and videos, design your own kite and order it from a shop that can make it.',
  ),
];

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _page = PageController();
  int _index = 0;

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  Future<void> _finish(String route) async {
    await ref.read(onboardingSeenProvider.notifier).markSeen();
    if (mounted) context.go(route);
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final last = _index == _slides.length - 1;

    return Scaffold(
      backgroundColor: AppColors.maroon900,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const KitePattern(),
          SafeArea(
            child: Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(24, 8, 24, 24),
              child: Column(
                children: [
                  Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: TextButton(
                      onPressed: () => _finish('/home'),
                      style: TextButton.styleFrom(foregroundColor: AppColors.maroon100),
                      child: Text('Skip'.tr),
                    ),
                  ),
                  Expanded(
                    child: PageView.builder(
                      controller: _page,
                      itemCount: _slides.length,
                      onPageChanged: (i) => setState(() => _index = i),
                      itemBuilder: (_, i) {
                        final s = _slides[i];
                        return Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Stack(
                              alignment: Alignment.center,
                              children: [
                                const KiteMark(size: 150, body: AppColors.maroon700, wing: AppColors.maroon500),
                                Icon(s.icon, size: 48, color: AppColors.white),
                              ],
                            ),
                            const SizedBox(height: 40),
                            Text(
                              s.title.tr,
                              textAlign: TextAlign.center,
                              style: t.textTheme.headlineMedium?.copyWith(color: AppColors.white),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              s.body.tr,
                              textAlign: TextAlign.center,
                              style: t.textTheme.bodyLarge?.copyWith(color: AppColors.maroon100),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (var i = 0; i < _slides.length; i++)
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: i == _index ? 22 : 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: i == _index ? AppColors.white : AppColors.maroon500,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 28),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.white,
                      foregroundColor: AppColors.maroon900,
                    ),
                    onPressed: last
                        ? () => _finish('/register')
                        : () => _page.nextPage(duration: const Duration(milliseconds: 280), curve: Curves.easeOut),
                    child: Text(last ? 'Create account'.tr : 'Next'.tr),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => _finish('/login'),
                    style: TextButton.styleFrom(foregroundColor: AppColors.white),
                    child: Text('I already have an account'.tr),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
