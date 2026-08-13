import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Authenticated user session data.
class SessionData {
  const SessionData({
    required this.token,
    required this.userId,
    required this.email,
    required this.name,
    required this.role,
    required this.tenantId,
    required this.tenantSlug,
  });

  final String token;
  final String userId;
  final String email;
  final String name;
  final String role;
  final String tenantId;
  final String tenantSlug;
}

/// Session manager: secure token storage and session state.
class SessionManager {
  SessionManager(this._storage);

  final FlutterSecureStorage _storage;

  static const String _tokenKey = 'auth_token';
  static const String _userIdKey = 'user_id';
  static const String _emailKey = 'user_email';
  static const String _nameKey = 'user_name';
  static const String _roleKey = 'user_role';
  static const String _tenantIdKey = 'tenant_id';
  static const String _tenantSlugKey = 'tenant_slug';

  /// Store session data securely.
  Future<void> save(SessionData session) async {
    await Future.wait([
      _storage.write(key: _tokenKey, value: session.token),
      _storage.write(key: _userIdKey, value: session.userId),
      _storage.write(key: _emailKey, value: session.email),
      _storage.write(key: _nameKey, value: session.name),
      _storage.write(key: _roleKey, value: session.role),
      _storage.write(key: _tenantIdKey, value: session.tenantId),
      _storage.write(key: _tenantSlugKey, value: session.tenantSlug),
    ]);
  }

  /// Load session data from secure storage.
  Future<SessionData?> load() async {
    final values = await Future.wait([
      _storage.read(key: _tokenKey),
      _storage.read(key: _userIdKey),
      _storage.read(key: _emailKey),
      _storage.read(key: _nameKey),
      _storage.read(key: _roleKey),
      _storage.read(key: _tenantIdKey),
      _storage.read(key: _tenantSlugKey),
    ]);

    if (values.any((v) => v == null)) {
      return null;
    }

    return SessionData(
      token: values[0]!,
      userId: values[1]!,
      email: values[2]!,
      name: values[3]!,
      role: values[4]!,
      tenantId: values[5]!,
      tenantSlug: values[6]!,
    );
  }

  /// Clear session data (logout).
  Future<void> clear() async {
    await _storage.deleteAll();
  }
}

/// Riverpod provider for SessionManager.
final sessionManagerProvider = Provider<SessionManager>((ref) {
  return SessionManager(const FlutterSecureStorage());
});

/// Riverpod provider for the current session state (null when logged out).
final sessionProvider = StateProvider<SessionData?>((ref) => null);
