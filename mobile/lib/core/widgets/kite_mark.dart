import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// The kite-diamond brand mark.
class KiteMark extends StatelessWidget {
  const KiteMark({super.key, this.size = 40, this.body = AppColors.maroon900, this.wing = AppColors.maroon500});

  final double size;
  final Color body;
  final Color wing;

  @override
  Widget build(BuildContext context) => CustomPaint(size: Size(size, size * 1.2), painter: _KitePainter(body, wing));
}

class _KitePainter extends CustomPainter {
  _KitePainter(this.body, this.wing);
  final Color body;
  final Color wing;

  @override
  void paint(Canvas canvas, Size s) {
    final top = Offset(s.width / 2, 0);
    final right = Offset(s.width, s.height * 0.42);
    final bottom = Offset(s.width / 2, s.height);
    final left = Offset(0, s.height * 0.42);
    final center = Offset(s.width / 2, s.height * 0.42);

    canvas.drawPath(Path()..addPolygon([top, right, bottom, left], true), Paint()..color = body);
    canvas.drawPath(Path()..addPolygon([top, right, center], true), Paint()..color = wing);
    canvas.drawPath(Path()..addPolygon([left, center, bottom], true), Paint()..color = wing.withValues(alpha: 0.8));

    final spar = Paint()
      ..color = Colors.white.withValues(alpha: 0.55)
      ..strokeWidth = s.width * 0.025;
    canvas.drawLine(top, bottom, spar);
    canvas.drawLine(left, right, spar);
  }

  @override
  bool shouldRepaint(_KitePainter old) => old.body != body || old.wing != wing;
}

/// Faint repeating kite-diamond pattern for maroon surfaces (5–7% opacity).
class KitePattern extends StatelessWidget {
  const KitePattern({super.key, this.cell = 56, this.opacity = 0.07});

  final double cell;
  final double opacity;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: CustomPaint(painter: _PatternPainter(cell, opacity), size: Size.infinite),
  );
}

class _PatternPainter extends CustomPainter {
  _PatternPainter(this.cell, this.opacity);
  final double cell;
  final double opacity;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = Colors.white.withValues(alpha: opacity)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (double y = 0; y < size.height + cell; y += cell) {
      for (double x = 0; x < size.width + cell; x += cell) {
        final cx = x + cell / 2, cy = y + cell / 2, h = cell * 0.44, w = cell * 0.31;
        canvas.drawPath(
          Path()
            ..moveTo(cx, cy - h)
            ..lineTo(cx + w, cy)
            ..lineTo(cx, cy + h)
            ..lineTo(cx - w, cy)
            ..close(),
          p,
        );
      }
    }
  }

  @override
  bool shouldRepaint(_PatternPainter old) => old.cell != cell || old.opacity != opacity;
}
