import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/models.dart';
import '../auth/auth_service.dart';

/// KOT service: generate KOTs from pending order items.
class KotService {
  KotService(this._client);

  final ApiClient _client;

  /// Generate a KOT from pending order items.
  Future<Kot> generate({
    required String orderId,
    String? station,
  }) async {
    final response = await _client.mutate(
      'kot',
      'generate',
      input: {
        'orderId': orderId,
        if (station != null) 'station': station,
      },
    );

    return Kot.fromJson(response);
  }

  /// List KOTs for an order or branch.
  Future<List<Kot>> list({
    required String branchId,
    String? orderId,
    String? status,
  }) async {
    final response = await _client.query(
      'kot',
      'list',
      input: {
        'branchId': branchId,
        if (orderId != null) 'orderId': orderId,
        if (status != null) 'status': status,
      },
    );

    final kots = response as List<dynamic>;
    return kots
        .map((json) => Kot.fromJson(json as Map<String, dynamic>))
        .toList();
  }
}

/// Riverpod provider for KotService.
final kotServiceProvider = Provider<KotService>((ref) {
  final client = ref.watch(apiClientProvider);
  return KotService(client);
});
