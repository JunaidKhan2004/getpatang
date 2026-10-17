import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/onboarding/onboarding_store.dart';
import 'i18n/i18n.dart';

const _kThemeKey = 'gp-theme';

/// Reads the saved ThemeMode from shared prefs.
/// Returns [ThemeMode.system] if nothing is saved.
ThemeMode _load(SharedPreferences prefs) => switch (prefs.getString(_kThemeKey)) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };

/// A Riverpod [StateNotifier] that persists the user's preferred [ThemeMode]
/// in shared prefs and exposes it app-wide.
class ThemeModeNotifier extends StateNotifier<ThemeMode> {
  ThemeModeNotifier(this._prefs) : super(_load(_prefs));

  final SharedPreferences _prefs;

  Future<void> setMode(ThemeMode mode) async {
    state = mode;
    final val = switch (mode) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      ThemeMode.system => 'system',
    };
    await _prefs.setString(_kThemeKey, val);
  }

  /// Cycle: system → light → dark → system
  Future<void> cycle() async {
    final next = switch (state) {
      ThemeMode.system => ThemeMode.light,
      ThemeMode.light => ThemeMode.dark,
      ThemeMode.dark => ThemeMode.system,
    };
    await setMode(next);
  }
}

final themeModeProvider =
    StateNotifierProvider<ThemeModeNotifier, ThemeMode>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  return ThemeModeNotifier(prefs);
});

// ─────────────────────────── UI widget ────────────────────────────────────

/// "Appearance" row in the Profile/Settings screen.
/// Shows the current mode and opens a bottom sheet picker.
class ThemeModeTile extends ConsumerWidget {
  const ThemeModeTile({super.key});

  static String _label(ThemeMode mode) => switch (mode) {
        ThemeMode.light => 'Light',
        ThemeMode.dark => 'Dark',
        ThemeMode.system => 'Follow phone setting',
      };

  static IconData _icon(ThemeMode mode) => switch (mode) {
        ThemeMode.light => Icons.light_mode_outlined,
        ThemeMode.dark => Icons.dark_mode_outlined,
        ThemeMode.system => Icons.brightness_auto_outlined,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    return ListTile(
      leading: Icon(_icon(mode)),
      title: Text('Appearance'.tr),
      subtitle: Text(_label(mode).tr),
      trailing: const Icon(Icons.chevron_right),
      onTap: () async {
        final picked = await showModalBottomSheet<ThemeMode>(
          context: context,
          showDragHandle: true,
          builder: (c) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final m in ThemeMode.values)
                  RadioListTile<ThemeMode>(
                    value: m,
                    groupValue: mode,
                    secondary: Icon(_icon(m)),
                    title: Text(_label(m).tr),
                    onChanged: (v) => Navigator.pop(c, v),
                  ),
              ],
            ),
          ),
        );
        if (picked == null) return;
        await ref.read(themeModeProvider.notifier).setMode(picked);
      },
    );
  }
}
