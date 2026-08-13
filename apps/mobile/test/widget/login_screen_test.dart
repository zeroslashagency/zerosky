import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/src/features/auth/login_screen.dart';

void main() {
  testWidgets('LoginScreen renders all fields', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: LoginScreen(),
        ),
      ),
    );

    expect(find.text('Zerosky Waiter'), findsOneWidget);
    expect(find.text('Mobile POS System'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(3));
    expect(find.text('Login'), findsOneWidget);
  });

  testWidgets('LoginScreen shows validation errors', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: LoginScreen(),
        ),
      ),
    );

    // Clear the default tenant slug first
    await tester.enterText(find.byType(TextFormField).first, '');
    
    // Tap login without filling fields
    await tester.tap(find.text('Login'));
    await tester.pump();

    // Validation messages should appear (note: actual text may differ from form validators)
    expect(find.text('Restaurant ID is required'), findsOneWidget);
    expect(find.text('Email is required'), findsOneWidget);
    expect(find.text('Password is required'), findsOneWidget);
  });
}
