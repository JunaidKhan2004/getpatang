import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/application/auth_controller.dart';
import '../data/marketplace_repository.dart';

/// Number of items in the cart for the header badge. 0 for guests or when offline.
final cartCountProvider = FutureProvider<int>((ref) async {
  final auth = ref.watch(authControllerProvider);
  if (auth is! Authenticated) return 0;
  try {
    return await ref.watch(marketplaceRepositoryProvider).cartCount();
  } catch (_) {
    return 0;
  }
});

/// Call after anything that changes the cart.
void refreshCart(WidgetRef ref) {
  ref.invalidate(cartCountProvider);
  ref.invalidate(cartProvider);
}
