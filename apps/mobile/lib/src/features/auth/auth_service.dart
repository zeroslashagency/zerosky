import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/session.dart';

/// Auth service: handles login and session management.
class AuthService {
  AuthService(this._client);

  final ApiClient _client;

  /// Login with email and password.
  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
    required String tenantSlug,
  }) async {
    return _client.mutate(
      'auth',
      'login',
      input: {
        'email': email,
        'password': password,
        'tenantSlug': tenantSlug,
      },
    );
  }

  /// Login with PIN (quick POS login).
  Future<Map<String, dynamic>> pinLogin({
    required String pin,
    required String tenantSlug,
  }) async {
    return _client.mutate(
      'auth',
      'pinLogin',
      input: {
        'pin': pin,
        'tenantSlug': tenantSlug,
      },
    );
  }
}

/// Riverpod provider for AuthService.
final authServiceProvider = Provider<AuthService>((ref) {
  final client = ref.watch(apiClientProvider);
  return AuthService(client);
});

/// Riverpod provider for ApiClient (shared across all services).
final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient();
  
  // Sync token changes from session state to ApiClient
  ref.listen<SessionData?>(sessionProvider, (previous, next) {
    client.setToken(next?.token);
  });

  return client;
});
