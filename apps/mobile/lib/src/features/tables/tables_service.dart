import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/models.dart';
import '../auth/auth_service.dart';

/// Tables service: fetch and update table state.
class TablesService {
  TablesService(this._client);

  final ApiClient _client;

  /// Fetch all tables for a branch.
  Future<List<Table>> list({required String branchId}) async {
    final response = await _client.query(
      'table',
      'list',
      input: {'branchId': branchId},
    );

    final tables = response as List<dynamic>;
    return tables
        .map((json) => Table.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  /// Update table state (AVAILABLE, OCCUPIED, RESERVED, etc.).
  Future<Table> setState({
    required String tableId,
    required String state,
  }) async {
    final response = await _client.mutate(
      'table',
      'setState',
      input: {'id': tableId, 'state': state},
    );

    return Table.fromJson(response);
  }
}

/// Riverpod provider for TablesService.
final tablesServiceProvider = Provider<TablesService>((ref) {
  final client = ref.watch(apiClientProvider);
  return TablesService(client);
});
