import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'src/core/theme.dart';
import 'src/core/session.dart';
import 'src/features/auth/login_screen.dart';
import 'src/features/tables/tables_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: ZeroskyApp()));
}

class ZeroskyApp extends ConsumerStatefulWidget {
  const ZeroskyApp({super.key});

  @override
  ConsumerState<ZeroskyApp> createState() => _ZeroskyAppState();
}

class _ZeroskyAppState extends ConsumerState<ZeroskyApp> {
  bool _isCheckingSession = true;

  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    final session = await ref.read(sessionManagerProvider).load();
    ref.read(sessionProvider.notifier).state = session;
    setState(() {
      _isCheckingSession = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isCheckingSession) {
      return MaterialApp(
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        home: const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    final session = ref.watch(sessionProvider);
    final initialRoute = session != null ? '/tables' : '/login';

    return MaterialApp(
      title: 'Zerosky Waiter',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      initialRoute: initialRoute,
      routes: {
        '/login': (context) => const LoginScreen(),
        '/tables': (context) => const TablesScreen(),
      },
    );
  }
}
