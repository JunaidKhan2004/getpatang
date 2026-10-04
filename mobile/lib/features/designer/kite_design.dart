/// Custom kite designs. Mirrors backend/src/modules/custom-orders/custom-orders.dto.ts and draws
/// with the same numbers as web/src/lib/designer.ts (canvas 200 × 260, body in the top 200 × 200).
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/i18n/i18n.dart';

const kiteShapes = {'diamond': 'Diamond', 'patang': 'Patang', 'delta': 'Delta', 'hexagon': 'Hexagon'};
const kiteSizes = {'small': 'Small (45 cm)', 'medium': 'Medium (60 cm)', 'large': 'Large (75 cm)'};
const kitePatterns = {
  'none': 'Plain',
  'stripes': 'Stripes',
  'checks': 'Checks',
  'halves': 'Halves',
  'quarters': 'Quarters',
  'border': 'Border',
  'stars': 'Stars',
};
const kiteFonts = {'sans': 'Clean', 'display': 'Bold', 'serif': 'Classic'};

/// Kite paper colours offered as swatches.
const kiteSwatches = [
  '#420000', '#7A1C1C', '#B3261E', '#E07A1F', '#F2C230', '#2E7D32', //
  '#1565C0', '#4A148C', '#111111', '#D4D7DD', '#EAE9E9', '#F6F6F6',
];

Color hexColor(String hex) => Color(int.parse('FF${hex.substring(1)}', radix: 16));
String colorHex(Color c) => '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0').toUpperCase()}';

class KiteDesign {
  const KiteDesign({
    this.shape = 'patang',
    this.size = 'medium',
    this.background = '#420000',
    this.pattern = 'halves',
    this.patternColor = '#F6F6F6',
    this.text = '',
    this.textColor = '#F6F6F6',
    this.font = 'display',
    this.tail = true,
    this.tailColor = '#D4D7DD',
    this.imageUploadId,
    this.imageUrl,
  });

  final String shape;
  final String size;
  final String background;
  final String pattern;
  final String patternColor;
  final String text;
  final String textColor;
  final String font;
  final bool tail;
  final String tailColor;
  final String? imageUploadId;
  final String? imageUrl;

  KiteDesign copyWith({
    String? shape,
    String? size,
    String? background,
    String? pattern,
    String? patternColor,
    String? text,
    String? textColor,
    String? font,
    bool? tail,
    String? tailColor,
  }) => KiteDesign(
    shape: shape ?? this.shape,
    size: size ?? this.size,
    background: background ?? this.background,
    pattern: pattern ?? this.pattern,
    patternColor: patternColor ?? this.patternColor,
    text: text ?? this.text,
    textColor: textColor ?? this.textColor,
    font: font ?? this.font,
    tail: tail ?? this.tail,
    tailColor: tailColor ?? this.tailColor,
    imageUploadId: imageUploadId,
    imageUrl: imageUrl,
  );

  KiteDesign withImage(String id, String url) => KiteDesign(
    shape: shape,
    size: size,
    background: background,
    pattern: pattern,
    patternColor: patternColor,
    text: text,
    textColor: textColor,
    font: font,
    tail: tail,
    tailColor: tailColor,
    imageUploadId: id,
    imageUrl: url,
  );

  KiteDesign withoutImage() => KiteDesign(
    shape: shape,
    size: size,
    background: background,
    pattern: pattern,
    patternColor: patternColor,
    text: text,
    textColor: textColor,
    font: font,
    tail: tail,
    tailColor: tailColor,
  );

  factory KiteDesign.fromJson(Map<String, dynamic> j) => KiteDesign(
    shape: j['shape'] as String,
    size: j['size'] as String,
    background: j['background'] as String,
    pattern: j['pattern'] as String,
    patternColor: j['patternColor'] as String,
    text: j['text'] as String? ?? '',
    textColor: j['textColor'] as String,
    font: j['font'] as String,
    tail: j['tail'] as bool,
    tailColor: j['tailColor'] as String,
    imageUploadId: j['imageUploadId'] as String?,
    imageUrl: j['imageUrl'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'shape': shape,
    'size': size,
    'background': background,
    'pattern': pattern,
    'patternColor': patternColor,
    if (text.trim().isNotEmpty) 'text': text.trim(),
    'textColor': textColor,
    'font': font,
    'tail': tail,
    'tailColor': tailColor,
    'imageUploadId': ?imageUploadId,
  };
}

// ─── Geometry ───────────────────────────────────────────────────────────────

const _body = <String, List<Offset>>{
  'diamond': [Offset(100, 8), Offset(178, 80), Offset(100, 192), Offset(22, 80)],
  'patang': [Offset(100, 14), Offset(186, 100), Offset(100, 186), Offset(14, 100)],
  'delta': [Offset(100, 14), Offset(190, 168), Offset(100, 148), Offset(10, 168)],
  'hexagon': [Offset(100, 10), Offset(178, 55), Offset(178, 145), Offset(100, 190), Offset(22, 145), Offset(22, 55)],
};
const _scale = {'small': 0.8, 'medium': 0.9, 'large': 1.0};
const _stars = [Offset(70, 60), Offset(130, 60), Offset(100, 100), Offset(70, 140), Offset(130, 140)];

List<Offset> bodyPoints(String shape, String size) {
  final s = _scale[size] ?? 0.9;
  return [for (final p in _body[shape] ?? _body['patang']!) Offset(100 + (p.dx - 100) * s, 100 + (p.dy - 100) * s)];
}

Offset tailAnchor(String shape, String size) {
  final pts = bodyPoints(shape, size);
  return shape == 'delta' ? pts[2] : pts.reduce((a, b) => b.dy > a.dy ? b : a);
}

double textSize(String text) => text.length > 16 ? 12 : (text.length > 10 ? 15 : 19);

/// Draws a design in a 200 × 260 canvas scaled to fit.
class KitePainter extends CustomPainter {
  KitePainter(this.d);
  final KiteDesign d;

  @override
  void paint(Canvas canvas, Size size) {
    final k = math.min(size.width / 200, size.height / 260);
    canvas
      ..save()
      ..translate((size.width - 200 * k) / 2, (size.height - 260 * k) / 2)
      ..scale(k);

    final pts = bodyPoints(d.shape, d.size);
    final body = Path()..addPolygon(pts, true);
    final bottom = tailAnchor(d.shape, d.size);

    if (d.tail) {
      final tail = Paint()
        ..color = hexColor(d.tailColor)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round;
      final fill = Paint()..color = hexColor(d.tailColor);
      final path = Path()..moveTo(bottom.dx, bottom.dy);
      var y = bottom.dy;
      var dir = 1.0;
      while (y < 250) {
        final ny = math.min(y + 36, 256.0);
        path.quadraticBezierTo(bottom.dx + 14 * dir, (y + ny) / 2, bottom.dx, ny);
        if (ny < 256) {
          canvas
            ..drawPath(
              Path()..addPolygon([
                Offset(bottom.dx, ny),
                Offset(bottom.dx - 9, ny - 5),
                Offset(bottom.dx - 9, ny + 5),
              ], true),
              fill,
            )
            ..drawPath(
              Path()..addPolygon([
                Offset(bottom.dx, ny),
                Offset(bottom.dx + 9, ny - 5),
                Offset(bottom.dx + 9, ny + 5),
              ], true),
              fill,
            );
        }
        y = ny;
        dir = -dir;
      }
      canvas.drawPath(path, tail);
    }

    canvas.drawPath(body, Paint()..color = hexColor(d.background));
    canvas
      ..save()
      ..clipPath(body);
    final pc = Paint()..color = hexColor(d.patternColor);
    switch (d.pattern) {
      case 'stripes':
        for (var i = 0; i < 9; i++) {
          canvas.drawRect(Rect.fromLTWH(0, i * 24.0, 200, 12), pc);
        }
      case 'checks':
        for (var i = 0; i < 64; i++) {
          final c = i % 8, r = i ~/ 8;
          if ((c + r).isEven) canvas.drawRect(Rect.fromLTWH(c * 25.0, r * 25.0, 25, 25), pc);
        }
      case 'halves':
        canvas.drawRect(const Rect.fromLTWH(100, 0, 100, 200), pc);
      case 'quarters':
        canvas
          ..drawRect(const Rect.fromLTWH(0, 0, 100, 100), pc)
          ..drawRect(const Rect.fromLTWH(100, 100, 100, 100), pc);
      case 'border':
        canvas.drawPath(
          body,
          Paint()
            ..color = hexColor(d.patternColor)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 16,
        );
      case 'stars':
        for (final s in _stars) {
          canvas.drawPath(_star(s, 11), pc);
        }
    }
    canvas.restore();

    final spar = Paint()
      ..color = const Color(0x38000000)
      ..strokeWidth = 1.5;
    final left = pts.reduce((a, b) => b.dx < a.dx ? b : a);
    final right = pts.reduce((a, b) => b.dx > a.dx ? b : a);
    canvas
      ..drawLine(pts[0], bottom, spar)
      ..drawLine(left, right, spar)
      ..drawPath(
        body,
        Paint()
          ..color = const Color(0x4D000000)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );

    final text = d.text.trim();
    if (text.isNotEmpty) {
      final tp = TextPainter(
        text: TextSpan(
          text: text,
          style: _font(
            TextStyle(
              color: hexColor(d.textColor),
              fontSize: textSize(text),
              fontWeight: d.font == 'display' ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout(maxWidth: 180);
      // Same baseline as the web SVG (y = 106, or 136 under a logo).
      final baseline = d.imageUrl != null ? 136.0 : 106.0;
      tp.paint(
        canvas,
        Offset(100 - tp.width / 2, baseline - tp.computeDistanceToActualBaseline(TextBaseline.alphabetic)),
      );
    }
    canvas.restore();
  }

  TextStyle _font(TextStyle s) => switch (d.font) {
    'display' => GoogleFonts.poppins(textStyle: s),
    'serif' => s.copyWith(fontFamily: 'serif'),
    _ => GoogleFonts.inter(textStyle: s),
  };

  Path _star(Offset c, double r) {
    final p = Path();
    for (var i = 0; i < 10; i++) {
      final a = math.pi / 5 * i - math.pi / 2;
      final rr = i.isEven ? r : r * 0.45;
      final pt = Offset(c.dx + rr * math.cos(a), c.dy + rr * math.sin(a));
      i == 0 ? p.moveTo(pt.dx, pt.dy) : p.lineTo(pt.dx, pt.dy);
    }
    return p..close();
  }

  @override
  bool shouldRepaint(KitePainter old) => old.d != d;
}

/// Preview widget: the painted kite plus the logo (a network image) placed where the web puts it.
class KitePreview extends StatelessWidget {
  const KitePreview({super.key, required this.design, this.height = 260});
  final KiteDesign design;
  final double height;

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Kite design preview'.tr,
    image: true,
    child: SizedBox(
      height: height,
      child: AspectRatio(
        aspectRatio: 200 / 260,
        child: LayoutBuilder(
          builder: (_, c) {
            final k = c.maxWidth / 200;
            final hasText = design.text.trim().isNotEmpty;
            return Stack(
              children: [
                Positioned.fill(child: CustomPaint(painter: KitePainter(design))),
                if (design.imageUrl != null)
                  Positioned(
                    left: 70 * k,
                    top: (hasText ? 58 : 70) * k,
                    width: 60 * k,
                    height: 60 * k,
                    child: ClipOval(
                      child: Image.network(
                        design.imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const SizedBox(),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    ),
  );
}
