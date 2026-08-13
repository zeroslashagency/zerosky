import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/src/core/api_client.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'dart:convert';

void main() {
  group('ApiClient', () {
    test('query unwraps superjson envelope correctly', () async {
      final mockClient = MockClient((request) async {
        expect(request.method, 'GET');
        expect(request.url.path, '/trpc/test.procedure');
        
        return http.Response(
          jsonEncode({
            'result': {
              'data': {
                'json': {'message': 'success'},
              },
            },
          }),
          200,
        );
      });

      final apiClient = ApiClient(
        baseUrl: 'http://localhost:3001/trpc',
        httpClient: mockClient,
      );

      final result = await apiClient.query('test', 'procedure');
      expect(result['message'], 'success');
    });

    test('mutate sends POST with correct body', () async {
      final mockClient = MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.path, '/trpc/auth.login');
        expect(request.headers['Content-Type'], contains('application/json'));
        
        final body = jsonDecode(request.body);
        expect(body['email'], 'test@example.com');

        return http.Response(
          jsonEncode({
            'result': {
              'data': {
                'json': {'token': 'test-token'},
              },
            },
          }),
          200,
        );
      });

      final apiClient = ApiClient(
        baseUrl: 'http://localhost:3001/trpc',
        httpClient: mockClient,
      );

      final result = await apiClient.mutate(
        'auth',
        'login',
        input: {'email': 'test@example.com'},
      );

      expect(result['token'], 'test-token');
    });

    test('handles tRPC error responses', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error': {
              'json': {
                'code': 'UNAUTHORIZED',
                'message': 'Invalid credentials',
              },
            },
          }),
          401,
        );
      });

      final apiClient = ApiClient(
        baseUrl: 'http://localhost:3001/trpc',
        httpClient: mockClient,
      );

      expect(
        () => apiClient.query('test', 'procedure'),
        throwsA(
          isA<TrpcException>()
              .having((e) => e.code, 'code', TrpcErrorCode.unauthorized)
              .having((e) => e.message, 'message', 'Invalid credentials'),
        ),
      );
    });

    test('attaches Authorization header when token is set', () async {
      final mockClient = MockClient((request) async {
        expect(request.headers['Authorization'], 'Bearer test-token');
        
        return http.Response(
          jsonEncode({
            'result': {
              'data': {
                'json': {},
              },
            },
          }),
          200,
        );
      });

      final apiClient = ApiClient(
        baseUrl: 'http://localhost:3001/trpc',
        httpClient: mockClient,
      );

      apiClient.setToken('test-token');
      await apiClient.query('test', 'procedure');
    });
  });
}
