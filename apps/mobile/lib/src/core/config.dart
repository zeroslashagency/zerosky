/// App configuration: environment-specific values.
class AppConfig {
  /// Base URL for the tRPC API server.
  /// 
  /// **IMPORTANT**: Physical devices cannot reach localhost. During development,
  /// use the machine's LAN IP (e.g., http://192.168.1.123:3001/trpc) instead of
  /// http://localhost:3001/trpc. Find your IP with `ipconfig getifaddr en0` on
  /// macOS or `ip addr` on Linux.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3001/trpc',
  );

  /// Default tenant slug for development.
  static const String defaultTenantSlug = String.fromEnvironment(
    'DEFAULT_TENANT_SLUG',
    defaultValue: 'zerosky-demo',
  );

  /// Request timeout in seconds.
  static const int requestTimeoutSeconds = 30;
}
