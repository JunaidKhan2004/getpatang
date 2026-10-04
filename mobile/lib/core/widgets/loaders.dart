import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'kite_mark.dart';
import '../i18n/i18n.dart';

/// Loading visuals: a flying-kite loader, a small kite spinner and shimmer skeletons.
/// Animations stop when the phone asks for reduced motion.

bool _reduceMotion(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;

/// One shared, repeating animation value for a subtree.
class _Ticker extends StatefulWidget {
  const _Ticker({required this.period, required this.builder});
  final Duration period;
  final Widget Function(BuildContext context, double t) builder;

  @override
  State<_Ticker> createState() => _TickerState();
}

class _TickerState extends State<_Ticker> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.period);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_reduceMotion(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      AnimatedBuilder(animation: _c, builder: (context, _) => widget.builder(context, _c.value));
}

// ─── Kite loader ────────────────────────────────────────────────────────────

/// A kite flying on the wind: it sways, bobs and its tail ripples, with a light sheen passing over it.
/// Use for whole screens or sections that are loading.
class KiteLoader extends StatelessWidget {
  const KiteLoader({super.key, this.size = 44, this.label, this.onDark = false});

  final double size;

  /// Optional text under the kite, e.g. "Loading products…".
  final String? label;

  /// White kite for maroon backgrounds (splash).
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final body = onDark ? AppColors.white : scheme.primary;
    final wing = onDark ? AppColors.maroon100 : AppColors.maroon500;
    final tail = onDark ? AppColors.maroon100 : scheme.primary.withValues(alpha: 0.55);

    return Semantics(
      label: label ?? 'Loading'.tr,
      liveRegion: true,
      child: ExcludeSemantics(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _Ticker(
              period: const Duration(milliseconds: 2200),
              builder: (context, t) {
                final a = t * 2 * math.pi;
                return SizedBox(
                  width: size * 1.6,
                  height: size * 2.3,
                  child: CustomPaint(
                    painter: _TailPainter(phase: a, color: tail, anchorY: size * 1.2 + math.sin(a * 2) * size * 0.06),
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: Transform.translate(
                        offset: Offset(math.sin(a) * size * 0.12, math.sin(a * 2) * size * 0.06),
                        child: Transform.rotate(
                          angle: math.sin(a) * 0.14,
                          child: _Sheen(
                            t: t,
                            child: KiteMark(size: size, body: body, wing: wing),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
            if (label != null) ...[
              const SizedBox(height: 8),
              Text(
                label!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: onDark ? AppColors.maroon100 : null),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The kite's string-and-bows tail, rippling with [phase].
class _TailPainter extends CustomPainter {
  _TailPainter({required this.phase, required this.color, required this.anchorY});
  final double phase;
  final Color color;
  final double anchorY;

  @override
  void paint(Canvas canvas, Size s) {
    final x0 = s.width / 2;
    final length = s.height - anchorY;
    if (length <= 0) return;
    final line = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = math.max(1.2, s.width * 0.018)
      ..strokeCap = StrokeCap.round;
    final bow = Paint()..color = color;
    final path = Path()..moveTo(x0, anchorY);
    const steps = 24;
    final amp = s.width * 0.09;
    for (var i = 1; i <= steps; i++) {
      final f = i / steps;
      // The wave grows towards the end of the tail, like cloth in the wind.
      final x = x0 + math.sin(phase * 1.5 - f * 5) * amp * f;
      path.lineTo(x, anchorY + length * f);
      if (i % 8 == 0 && i < steps) {
        final y = anchorY + length * f;
        final w = s.width * 0.06;
        canvas
          ..drawPath(
            Path()..addPolygon([Offset(x, y), Offset(x - w, y - w * 0.6), Offset(x - w, y + w * 0.6)], true),
            bow,
          )
          ..drawPath(
            Path()..addPolygon([Offset(x, y), Offset(x + w, y - w * 0.6), Offset(x + w, y + w * 0.6)], true),
            bow,
          );
      }
    }
    canvas.drawPath(path, line);
  }

  @override
  bool shouldRepaint(_TailPainter old) => old.phase != phase || old.color != color || old.anchorY != anchorY;
}

/// A soft white band sweeping across [child].
class _Sheen extends StatelessWidget {
  const _Sheen({required this.t, required this.child});
  final double t;
  final Widget child;

  @override
  Widget build(BuildContext context) => ShaderMask(
    blendMode: BlendMode.srcATop,
    shaderCallback: (rect) {
      final x = -1.5 + t * 3.0;
      return LinearGradient(
        begin: Alignment(x - 0.6, -1),
        end: Alignment(x + 0.6, 1),
        colors: [Colors.transparent, Colors.white.withValues(alpha: 0.45), Colors.transparent],
        stops: const [0, 0.5, 1],
      ).createShader(rect);
    },
    child: child,
  );
}

/// Small kite for buttons and "loading more" rows: it bobs and tilts in place.
class KiteSpinner extends StatelessWidget {
  const KiteSpinner({super.key, this.size = 20, this.color});
  final double size;

  /// Defaults to the surrounding icon colour (e.g. a button's text colour).
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? IconTheme.of(context).color ?? Theme.of(context).colorScheme.primary;
    return Semantics(
      label: 'Loading'.tr,
      child: SizedBox(
        width: size,
        height: size * 1.2,
        child: _Ticker(
          period: const Duration(milliseconds: 1100),
          builder: (context, t) {
            final a = t * 2 * math.pi;
            return Transform.translate(
              offset: Offset(0, -math.sin(a).abs() * size * 0.12),
              child: Transform.rotate(
                angle: math.sin(a) * 0.35,
                child: KiteMark(size: size, body: c, wing: c.withValues(alpha: 0.6)),
              ),
            );
          },
        ),
      ),
    );
  }
}

// ─── Shimmer skeletons ──────────────────────────────────────────────────────

/// Paints a moving highlight over its children. Everything inside should be [SkeletonBox] /
/// [KiteSkeleton] shapes; they are drawn in the base colour and the sheen passes over them together.
class Shimmer extends StatelessWidget {
  const Shimmer({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    // Client palette: #D4D7DD shapes with a #F6F6F6 sheen (dark mode uses the dark surfaces).
    final base = dark ? AppColors.darkSurface2 : AppColors.neutral200;
    final highlight = dark ? AppColors.darkBorder : AppColors.neutral50;
    return Semantics(
      label: 'Loading'.tr,
      child: ExcludeSemantics(
        child: _Ticker(
          period: const Duration(milliseconds: 1400),
          builder: (context, t) => ShaderMask(
            blendMode: BlendMode.srcATop,
            shaderCallback: (rect) {
              final x = -1.0 + t * 3.0;
              return LinearGradient(
                begin: Alignment(x - 1, -0.3),
                end: Alignment(x, 0.3),
                colors: [base, highlight, base],
                stops: const [0.1, 0.5, 0.9],
              ).createShader(rect);
            },
            child: child,
          ),
        ),
      ),
    );
  }
}

/// A rounded placeholder block (text line, avatar, image).
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({super.key, this.width, this.height = 12, this.radius = 6, this.circle = false});
  final double? width;
  final double height;
  final double radius;
  final bool circle;

  @override
  Widget build(BuildContext context) => Container(
    width: circle ? height : width,
    height: height,
    decoration: BoxDecoration(
      color: Colors.white, // replaced by the shimmer colours
      shape: circle ? BoxShape.circle : BoxShape.rectangle,
      borderRadius: circle ? null : BorderRadius.circular(radius),
    ),
  );
}

/// Kite-shaped placeholder, used where a product photo will appear.
class KiteSkeleton extends StatelessWidget {
  const KiteSkeleton({super.key, this.size = 44});
  final double size;

  @override
  Widget build(BuildContext context) =>
      KiteMark(size: size, body: Colors.white, wing: Colors.white.withValues(alpha: 0.7));
}

/// Placeholder product card matching ProductTile: photo area with a kite, shop, title, stars, price.
class ProductCardSkeleton extends StatelessWidget {
  const ProductCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final line = Theme.of(context).colorScheme.outlineVariant.withValues(alpha: 0.5);
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: line),
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Shimmer(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Takes whatever height the grid cell leaves after the text, so it never overflows.
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Lighter photo area so the kite shape stands out.
                  Opacity(opacity: 0.4, child: Container(color: Colors.white)),
                  const Center(child: KiteSkeleton(size: 40)),
                ],
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(10, 10, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonBox(width: 70, height: 9),
                  SizedBox(height: 8),
                  SkeletonBox(height: 12),
                  SizedBox(height: 6),
                  SkeletonBox(width: 90, height: 12),
                  SizedBox(height: 10),
                  SkeletonBox(width: 60, height: 9),
                  SizedBox(height: 10),
                  SkeletonBox(width: 80, height: 16),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Placeholder row for lists (orders, notifications, tournaments…): a kite or circle and two lines.
class ListRowSkeleton extends StatelessWidget {
  const ListRowSkeleton({super.key, this.kite = true});
  final bool kite;

  @override
  Widget build(BuildContext context) {
    final line = Theme.of(context).colorScheme.outlineVariant.withValues(alpha: 0.5);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: line),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Shimmer(
        child: Row(
          children: [
            if (kite) const KiteSkeleton(size: 30) else const SkeletonBox(height: 40, circle: true),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonBox(width: 120, height: 9),
                  SizedBox(height: 8),
                  SkeletonBox(height: 13),
                  SizedBox(height: 8),
                  SkeletonBox(width: 160, height: 10),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Placeholder paragraphs for text pages.
class TextSkeleton extends StatelessWidget {
  const TextSkeleton({super.key, this.paragraphs = 3});
  final int paragraphs;

  @override
  Widget build(BuildContext context) => Shimmer(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SkeletonBox(width: 180, height: 20),
        const SizedBox(height: 18),
        for (var p = 0; p < paragraphs; p++) ...[
          for (var l = 0; l < 4; l++) ...[
            SkeletonBox(width: l == 3 ? 150 : null, height: 11),
            const SizedBox(height: 9),
          ],
          const SizedBox(height: 12),
        ],
      ],
    ),
  );
}

/// Sliver of placeholder product cards, laid out like the real grid.
class ProductGridSkeleton extends StatelessWidget {
  const ProductGridSkeleton({super.key, required this.gridDelegate, this.count = 6});
  final SliverGridDelegate gridDelegate;
  final int count;

  @override
  Widget build(BuildContext context) => SliverGrid.builder(
    gridDelegate: gridDelegate,
    itemCount: count,
    itemBuilder: (_, _) => const ProductCardSkeleton(),
  );
}

/// Sliver of placeholder list rows.
class ListSkeleton extends StatelessWidget {
  const ListSkeleton({super.key, this.count = 6, this.kite = true});
  final int count;
  final bool kite;

  @override
  Widget build(BuildContext context) => SliverList.separated(
    itemCount: count,
    separatorBuilder: (_, _) => const SizedBox(height: 10),
    itemBuilder: (_, _) => ListRowSkeleton(kite: kite),
  );
}
