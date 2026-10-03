import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kite_platform/features/content/content_page.dart';

void main() {
  testWidgets('renders headings, paragraphs and lists like the web', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => ListView(
            children: renderPageBody(
              context,
              '## Safety\n\nFly in open fields.\n\n- Cotton string only\n- No metal wire',
            ),
          ),
        ),
      ),
    );
    expect(find.text('Safety'), findsOneWidget);
    expect(find.text('Fly in open fields.'), findsOneWidget);
    expect(find.text('Cotton string only'), findsOneWidget);
    expect(find.text('•  '), findsNWidgets(2));
  });
}
