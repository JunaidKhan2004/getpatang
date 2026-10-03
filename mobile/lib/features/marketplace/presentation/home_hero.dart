import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/kite_mark.dart';

/// Home header: a dusk sky in the brand maroons with a large patang flying on the right, smaller
/// kites drifting at different depths, a breathing glow and a staggered reveal of the text.
/// Scrolling moves the kites slower than the page (parallax). Matches the website's home hero.
/// Everything holds still when the phone asks for reduced motion.
class HomeHero extends StatefulWidget {
  const HomeHero({super.key, required this.scroll, required this.top, required this.search});

  /// The page's scroll position, for parallax.
  final ScrollController scroll;

  /// Greeting row (location, name, cart/notifications).
  final Widget top;

  /// Search field shown at the bottom of the hero.
  final Widget search;

  @override
  State<HomeHero> createState() => _HomeHeroState();
}

class _HomeHeroState extends State<HomeHero> with TickerProviderStateMixin {
  /// Drives flying, drifting, the tail and the glow. One loop is 7 seconds.
  late final AnimationController _sky = AnimationController(vsync: this, duration: const Duration(seconds: 7));

  /// Runs once: text and search rise in one after another.
  late final AnimationController _reveal = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (still) {
      _sky.stop();
      _reveal.value = 1;
    } else if (!_started) {
      _started = true;
      _sky.repeat();
      _reveal.forward();
    }
  }

  @override
  void dispose() {
    _sky.dispose();
    _reveal.dispose();
    super.dispose();
  }

  Widget _rise(int step, Widget child) {
    final curve = CurvedAnimation(
      parent: _reveal,
      curve: Interval(step * 0.14, 0.55 + step * 0.14, curve: Curves.easeOutCubic),
    );
    return AnimatedBuilder(
      animation: curve,
      builder: (_, c) => Opacity(
        opacity: curve.value,
        child: Transform.translate(offset: Offset(0, 16 * (1 - curve.value)), child: c),
      ),
      child: child,
    );
  }

  double get _offset => widget.scroll.hasClients ? widget.scroll.offset.clamp(0, 400).toDouble() : 0;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return ClipRect(
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.maroon950, AppColors.maroon900, Color(0xFF5A0D0D)],
            stops: [0, 0.55, 1],
          ),
        ),
        child: Stack(
          children: [
            // Sky: glow, pattern, distant kites and the big kite, all behind the content.
            Positioned.fill(
              child: RepaintBoundary(
                child: AnimatedBuilder(
                  animation: Listenable.merge([_sky, widget.scroll]),
                  builder: (_, _) => CustomPaint(
                    painter: _SkyPainter(t: _sky.value, scroll: _offset),
                  ),
                ),
              ),
            ),
            const Positioned.fill(child: KitePattern(cell: 44)),
            SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 4, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _rise(0, widget.top),
                    const SizedBox(height: 18),
                    // Leave the right side to the kite.
                    FractionallySizedBox(
                      widthFactor: 0.66,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _rise(
                            1,
                            Text(
                              'Fly higher with the kite community.',
                              style: t.textTheme.headlineSmall?.copyWith(
                                color: AppColors.white,
                                fontWeight: FontWeight.w700,
                                height: 1.2,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          _rise(
                            2,
                            Text(
                              'Trusted shops · Approved tournaments · Events',
                              style: t.textTheme.bodySmall?.copyWith(color: AppColors.maroon100),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    _rise(3, Padding(padding: const EdgeInsets.only(right: 12), child: widget.search)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Distant kites: position (fraction of the hero), size, depth (0 far → 1 near), speed and phase.
const _distant = [
  (x: 0.06, y: 0.30, size: 16.0, depth: 0.25, speed: 1.0, phase: 0.0),
  (x: 0.30, y: 0.08, size: 11.0, depth: 0.12, speed: 0.8, phase: 1.7),
  (x: 0.52, y: 0.62, size: 13.0, depth: 0.18, speed: 1.2, phase: 3.1),
  (x: 0.62, y: 0.20, size: 10.0, depth: 0.1, speed: 0.9, phase: 4.4),
  (x: 0.42, y: 0.40, size: 9.0, depth: 0.08, speed: 1.1, phase: 5.2),
];

class _SkyPainter extends CustomPainter {
  _SkyPainter({required this.t, required this.scroll});
  final double t;
  final double scroll;

  @override
  void paint(Canvas canvas, Size size) {
    final a = t * 2 * math.pi;

    // Breathing glow behind the big kite.
    final glowCenter = Offset(size.width * 0.86, size.height * 0.42 + scroll * 0.3);
    final glowR = size.width * (0.55 + 0.03 * math.sin(a));
    canvas.drawCircle(
      glowCenter,
      glowR,
      Paint()
        ..shader = RadialGradient(
          colors: [
            const Color(0xFF9B3B3B).withValues(alpha: 0.45 + 0.1 * math.sin(a)),
            const Color(0xFF6B1A1A).withValues(alpha: 0.2),
            Colors.transparent,
          ],
          stops: const [0, 0.55, 1],
        ).createShader(Rect.fromCircle(center: glowCenter, radius: glowR)),
    );

    // Distant kites drift on slow loops; deeper ones lag more when scrolling.
    for (final k in _distant) {
      final p = a * k.speed + k.phase;
      final c = Offset(
        size.width * k.x + math.sin(p) * 10,
        size.height * k.y + math.cos(p * 0.8) * 7 + scroll * (0.6 - k.depth),
      );
      _smallKite(canvas, c, k.size, 0.15 + k.depth * 0.9, math.sin(p) * 0.2);
    }

    // The big patang on the right, below the greeting row.
    final scale = (size.width * 0.34) / 260; // web viewBox is 260 × 420
    final fly = Offset(math.sin(a) * 6, -((math.sin(a * 2) + 1) / 2) * 8);
    canvas
      ..save()
      ..translate(size.width * 0.63 + fly.dx, 74 + fly.dy + scroll * 0.35)
      ..scale(scale)
      ..translate(130, 70)
      ..rotate(math.sin(a) * 0.06)
      ..translate(-130, -70);
    _bigKite(canvas, a);
    canvas.restore();
  }

  void _smallKite(Canvas canvas, Offset c, double s, double opacity, double tilt) {
    canvas
      ..save()
      ..translate(c.dx, c.dy)
      ..rotate(tilt);
    final body = Path()..addPolygon([Offset(0, -s), Offset(s * 0.85, 0), Offset(0, s), Offset(-s * 0.85, 0)], true);
    canvas
      ..drawPath(body, Paint()..color = Colors.white.withValues(alpha: opacity))
      ..drawPath(
        Path()..addPolygon([Offset(0, -s), Offset(s * 0.85, 0), Offset.zero], true),
        Paint()..color = AppColors.maroon100.withValues(alpha: opacity),
      );
    final tail = Path()..moveTo(0, s);
    for (var i = 1; i <= 4; i++) {
      tail.quadraticBezierTo((i.isOdd ? 3 : -3) * s / 10, s + s * 0.35 * (i - 0.5), 0, s + s * 0.35 * i);
    }
    canvas
      ..drawPath(
        tail,
        Paint()
          ..color = Colors.white.withValues(alpha: opacity * 0.8)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.9,
      )
      ..restore();
  }

  /// Same drawing as web/src/components/site/home-hero.tsx (260 × 420 units).
  void _bigKite(Canvas canvas, double a) {
    Paint fill(int c) => Paint()..color = Color(c);
    // Dor (string) running down to someone on the ground.
    canvas.drawPath(
      Path()
        ..moveTo(130, 140)
        ..quadraticBezierTo(20, 420, -420, 760),
      Paint()
        ..color = Colors.white.withValues(alpha: 0.35)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6,
    );
    // Tail ripples faster than the kite sways; bows flutter.
    final tail = Path()..moveTo(130, 250);
    final bows = <Offset>[];
    for (var i = 1; i <= 24; i++) {
      final f = i / 24;
      final x = 130 + math.sin(a * 2.7 - f * 6) * 16 * f;
      final y = 250 + 160 * f;
      tail.lineTo(x, y);
      if (i == 8 || i == 16 || i == 24) bows.add(Offset(x, y));
    }
    canvas.drawPath(
      tail,
      Paint()
        ..color = AppColors.maroon100
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round,
    );
    for (var i = 0; i < bows.length; i++) {
      final b = bows[i];
      final w = 12 * (0.75 + 0.25 * math.sin(a * 5 + i));
      canvas
        ..drawPath(Path()..addPolygon([b, b + Offset(-w, -7), b + Offset(-w, 7)], true), fill(0xFFF2E4E4))
        ..drawPath(Path()..addPolygon([b, b + Offset(w, -7), b + Offset(w, 7)], true), fill(0xFFF2E4E4));
    }
    // Body: patang halves in the client palette.
    const top = Offset(130, 10), right = Offset(240, 130), bottom = Offset(130, 250), left = Offset(20, 130);
    const mid = Offset(130, 130);
    canvas
      ..drawPath(Path()..addPolygon([top, right, bottom, left], true), fill(0xFFF6F6F6))
      ..drawPath(Path()..addPolygon([top, right, bottom], true), fill(0xFF9B3B3B))
      ..drawPath(Path()..addPolygon([top, right, mid], true), fill(0xFF6B1A1A))
      ..drawPath(Path()..addPolygon([left, mid, bottom], true), fill(0xFFEAE9E9))
      ..drawCircle(mid, 18, fill(0xFF420000))
      ..drawCircle(mid, 7, fill(0xFFF6F6F6));
    final spar = Paint()
      ..color = const Color(0xFF2A0000).withValues(alpha: 0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;
    canvas
      ..drawLine(top, bottom, spar)
      ..drawPath(
        Path()
          ..moveTo(24, 128)
          ..quadraticBezierTo(130, 96, 236, 128),
        spar,
      );
  }

  @override
  bool shouldRepaint(_SkyPainter old) => old.t != t || old.scroll != scroll;
}
