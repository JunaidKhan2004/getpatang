import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kite_platform/features/designer/kite_design.dart';

void main() {
  test('body geometry matches the web numbers', () {
    expect(bodyPoints('diamond', 'large').first, const Offset(100, 8));
    expect(bodyPoints('patang', 'small')[1].dx, closeTo(168.8, 0.001));
    expect(tailAnchor('delta', 'large'), const Offset(100, 148));
    expect(tailAnchor('hexagon', 'medium').dy, closeTo(181, 0.001));
  });

  test('design json round trip drops empty text and keeps the image id', () {
    const d = KiteDesign(text: '  ', imageUploadId: 'u1');
    final json = d.toJson();
    expect(json.containsKey('text'), isFalse);
    expect(json['imageUploadId'], 'u1');
    expect(KiteDesign.fromJson({...json, 'text': null}).text, '');
  });

  testWidgets('every shape and pattern paints', (tester) async {
    for (final shape in kiteShapes.keys) {
      for (final pattern in kitePatterns.keys) {
        await tester.pumpWidget(
          MaterialApp(
            home: Center(
              child: KitePreview(
                design: KiteDesign(shape: shape, pattern: pattern, text: 'TEAM', font: 'serif'),
              ),
            ),
          ),
        );
        expect(tester.takeException(), isNull);
      }
    }
  });
}
