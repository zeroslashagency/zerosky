import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/models.dart';
import '../auth/auth_service.dart';

/// Order service: create orders, add items, fetch order details.
class OrderService {
  OrderService(this._client);

  final ApiClient _client;

  /// Create a new order.
  Future<Order> create({
    required String branchId,
    required String type,
    required int guestCount,
    required List<Map<String, dynamic>> items,
    String? tableId,
    String? notes,
  }) async {
    final response = await _client.mutate(
      'order',
      'create',
      input: {
        'branchId': branchId,
        'type': type,
        'guestCount': guestCount,
        'items': items,
        if (tableId != null) 'tableId': tableId,
        if (notes != null) 'notes': notes,
      },
    );

    return Order.fromJson(response);
  }

  /// Add items to an existing order.
  Future<Order> addItems({
    required String orderId,
    required List<Map<String, dynamic>> items,
  }) async {
    final response = await _client.mutate(
      'order',
      'addItems',
      input: {
        'orderId': orderId,
        'items': items,
      },
    );

    return Order.fromJson(response);
  }

  /// Get order details.
  Future<Order> get({required String orderId}) async {
    final response = await _client.query(
      'order',
      'get',
      input: {'id': orderId},
    );

    return Order.fromJson(response);
  }

  /// List orders for a branch.
  Future<List<Order>> list({
    required String branchId,
    String? status,
    int limit = 50,
  }) async {
    final response = await _client.query(
      'order',
      'list',
      input: {
        'branchId': branchId,
        if (status != null) 'status': status,
        'limit': limit,
      },
    );

    final orders = response as List<dynamic>;
    return orders
        .map((json) => Order.fromJson(json as Map<String, dynamic>))
        .toList();
  }
}

/// Riverpod provider for OrderService.
final orderServiceProvider = Provider<OrderService>((ref) {
  final client = ref.watch(apiClientProvider);
  return OrderService(client);
});
