import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Overridden in main() with the loaded instance so reads are synchronous.
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) => throw UnimplementedError());

class OnboardingSeenController extends Notifier<bool> {
  static const _key = 'onboarding_seen';

  @override
  bool build() => ref.read(sharedPreferencesProvider).getBool(_key) ?? false;

  Future<void> markSeen() async {
    await ref.read(sharedPreferencesProvider).setBool(_key, true);
    state = true;
  }
}

final onboardingSeenProvider = NotifierProvider<OnboardingSeenController, bool>(OnboardingSeenController.new);
