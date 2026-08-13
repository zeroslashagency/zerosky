import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/models.dart';
import '../auth/auth_service.dart';

/// Menu service: fetch menu items and categories.
class MenuService {
  MenuService(this._client);

  final ApiClient _client;

  /// Fetch all menus with categories and items.
  Future<List<Category>> list({bool includeInactive = false}) async {
    final response = await _client.query(
      'menu',
      'list',
      input: {'includeInactive': includeInactive},
    );

    final menus = response as List<dynamic>;
    if (menus.isEmpty) return [];

    // Return categories from the first (default) menu
    final firstMenu = menus[0] as Map<String, dynamic>;
    final categories = firstMenu['categories'] as List<dynamic>?;
    
    if (categories == null) return [];

    return categories
        .map((json) => Category.fromJson(json as Map<String, dynamic>))
        .toList();
  }
}

/// Riverpod provider for MenuService.
final menuServiceProvider = Provider<MenuService>((ref) {
  final client = ref.watch(apiClientProvider);
  return MenuService(client);
});
