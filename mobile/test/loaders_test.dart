import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kite_platform/core/widgets/kite_mark.dart';
import 'package:kite_platform/core/widgets/loaders.dart';

Widget _app(Widget child, {bool reduceMotion = false}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduceMotion),
    child: Scaffold(body: child),
  ),
);

void main() {
  testWidgets('kite loader animates and is announced to screen readers', (tester) async {
    await tester.pumpWidget(_app(const Center(child: KiteLoader(label: 'Loading products…'))));
    final before = tester.getTopLeft(find.byType(KiteMark));
    await tester.pump(const Duration(milliseconds: 550));
    expect(tester.getTopLeft(find.byType(KiteMark)), isNot(before));
    expect(find.bySemanticsLabel('Loading products…'), findsOneWidget);
    expect(tester.binding.hasScheduledFrame, isTrue);
  });

  testWidgets('everything stays still when the phone asks for reduced motion', (tester) async {
    await tester.pumpWidget(_app(const Center(child: KiteLoader()), reduceMotion: true));
    await tester.pump(const Duration(milliseconds: 550));
    expect(tester.binding.hasScheduledFrame, isFalse);
  });

  testWidgets('skeletons lay out without overflow in a grid and a list', (tester) async {
    await tester.pumpWidget(
      _app(
        const CustomScrollView(
          slivers: [
            ProductGridSkeleton(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisExtent: 300),
              count: 4,
            ),
            ListSkeleton(count: 3),
          ],
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 300));
    expect(tester.takeException(), isNull);
    expect(find.byType(ProductCardSkeleton), findsWidgets);
    expect(find.byType(KiteSkeleton), findsWidgets);
  });

  testWidgets('small spinner fits inside a button', (tester) async {
    await tester.pumpWidget(_app(Center(child: FilledButton(onPressed: null, child: const KiteSpinner(size: 18)))));
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.takeException(), isNull);
  });
}
