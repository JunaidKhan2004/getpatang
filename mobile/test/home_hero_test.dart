import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kite_platform/features/marketplace/presentation/home_hero.dart';

Widget _page(ScrollController scroll, {bool still = false}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(size: const Size(360, 800), disableAnimations: still, padding: const EdgeInsets.only(top: 24)),
    child: Scaffold(
      body: CustomScrollView(
        controller: scroll,
        slivers: [
          SliverToBoxAdapter(
            child: RepaintBoundary(
              key: const Key('hero'),
              child: HomeHero(
                scroll: scroll,
                top: const SizedBox(height: 48, child: Text('Welcome to GetPatang')),
                search: Container(height: 50, color: Colors.white),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 1200)),
        ],
      ),
    ),
  ),
);

void main() {
  testWidgets('hero reveals its text, keeps flying and scrolls without errors', (tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final scroll = ScrollController();
    await tester.pumpWidget(_page(scroll));
    await tester.pump(const Duration(milliseconds: 1200));
    expect(find.text('Fly higher with the kite community.'), findsOneWidget);
    expect(tester.binding.hasScheduledFrame, isTrue);
    scroll.jumpTo(120);
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.takeException(), isNull);
  });

  testWidgets('hero is still and fully shown with reduced motion', (tester) async {
    final scroll = ScrollController();
    await tester.pumpWidget(_page(scroll, still: true));
    await tester.pump();
    expect(tester.binding.hasScheduledFrame, isFalse);
    final text = tester.widget<Opacity>(
      find.ancestor(of: find.text('Fly higher with the kite community.'), matching: find.byType(Opacity)).first,
    );
    expect(text.opacity, 1);
  });
}
