import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'config.dart';

/// tRPC error codes (subset used by the mobile client).
enum TrpcErrorCode {
  unauthorized('UNAUTHORIZED'),
  forbidden('FORBIDDEN'),
  notFound('NOT_FOUND'),
  badRequest('BAD_REQUEST'),
  tooManyRequests('TOO_MANY_REQUESTS'),
  internalServerError('INTERNAL_SERVER_ERROR'),
  unknown('UNKNOWN');

  const TrpcErrorCode(this.code);
  final String code;

  static TrpcErrorCode fromString(String code) {
    return values.firstWhere(
      (e) => e.code == code,
      orElse: () => TrpcErrorCode.unknown,
    );
  }
}

/// Structured tRPC error.
class TrpcException implements Exception {
  TrpcException({
    required this.code,
    required this.message,
    this.data,
  });

  final TrpcErrorCode code;
  final String message;
  final Map<String, dynamic>? data;

  @override
  String toString() => 'TrpcException($code): $message';
}

/// tRPC API client: handles wire format, superjson envelope, and auth headers.
/// 
/// Wire format (tRPC v11 with superjson transformer):
/// - Queries: GET {base}/{router}.{procedure}?input={urlencoded-json}
/// - Mutations: POST {base}/{router}.{procedure} with JSON body
/// - Superjson wraps responses: {"result":{"data":{"json":{...}}}}
/// - Errors: {"error":{"json":{"message":"...", "code":"..."}}}
class ApiClient {
  ApiClient({
    String? baseUrl,
    http.Client? httpClient,
  })  : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
        _client = httpClient ?? http.Client();

  final String _baseUrl;
  final http.Client _client;
  String? _token;

  /// Set the auth token (raw user ID today; will become JWT later).
  void setToken(String? token) {
    _token = token;
  }

  /// Execute a tRPC query (GET).
  Future<Map<String, dynamic>> query(
    String router,
    String procedure, {
    Map<String, dynamic>? input,
  }) async {
    final path = '$router.$procedure';
    final queryParams = input != null
        ? '?input=${Uri.encodeComponent(jsonEncode(input))}'
        : '';
    final uri = Uri.parse('$_baseUrl/$path$queryParams');

    try {
      final response = await _client
          .get(uri, headers: _buildHeaders())
          .timeout(Duration(seconds: AppConfig.requestTimeoutSeconds));

      return _handleResponse(response);
    } on TimeoutException {
      throw TrpcException(
        code: TrpcErrorCode.unknown,
        message: 'Request timed out',
      );
    } on http.ClientException catch (e) {
      throw TrpcException(
        code: TrpcErrorCode.unknown,
        message: 'Network error: ${e.message}',
      );
    }
  }

  /// Execute a tRPC mutation (POST).
  Future<Map<String, dynamic>> mutate(
    String router,
    String procedure, {
    Map<String, dynamic>? input,
  }) async {
    final path = '$router.$procedure';
    final uri = Uri.parse('$_baseUrl/$path');

    try {
      final response = await _client
          .post(
            uri,
            headers: _buildHeaders(),
            body: input != null ? jsonEncode(input) : null,
          )
          .timeout(Duration(seconds: AppConfig.requestTimeoutSeconds));

      return _handleResponse(response);
    } on TimeoutException {
      throw TrpcException(
        code: TrpcErrorCode.unknown,
        message: 'Request timed out',
      );
    } on http.ClientException catch (e) {
      throw TrpcException(
        code: TrpcErrorCode.unknown,
        message: 'Network error: ${e.message}',
      );
    }
  }

  Map<String, String> _buildHeaders() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (_token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  /// Parse tRPC response, unwrap superjson envelope, and handle errors.
  Map<String, dynamic> _handleResponse(http.Response response) {
    final body = jsonDecode(response.body) as Map<String, dynamic>;

    // tRPC error response
    if (body.containsKey('error')) {
      final error = body['error'] as Map<String, dynamic>;
      final errorJson = error['json'] as Map<String, dynamic>?;
      
      if (errorJson != null) {
        final code = TrpcErrorCode.fromString(
          errorJson['code'] as String? ?? 'UNKNOWN',
        );
        final message = errorJson['message'] as String? ?? 'Unknown error';
        final data = errorJson['data'] as Map<String, dynamic>?;

        throw TrpcException(code: code, message: message, data: data);
      }

      throw TrpcException(
        code: TrpcErrorCode.unknown,
        message: 'Malformed error response',
      );
    }

    // Success response: unwrap superjson envelope
    if (body.containsKey('result')) {
      final result = body['result'] as Map<String, dynamic>;
      final data = result['data'] as Map<String, dynamic>?;
      
      if (data != null && data.containsKey('json')) {
        return data['json'] as Map<String, dynamic>;
      }

      throw TrpcException(
        code: TrpcErrorCode.unknown,
        message: 'Malformed success response (missing json envelope)',
      );
    }

    throw TrpcException(
      code: TrpcErrorCode.unknown,
      message: 'Malformed response (no result or error)',
    );
  }
}
