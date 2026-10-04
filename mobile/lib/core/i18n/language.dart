import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/auth/application/auth_controller.dart';
import '../../features/onboarding/onboarding_store.dart';
import '../network/api_client.dart';
import 'i18n.dart';

/// Holds the ProviderScope. Changing the language rebuilds it, so every screen and every
/// cached server response (labels come back translated from the API) is loaded again.
class LanguageRoot extends StatefulWidget {
  const LanguageRoot({super.key, required this.prefs, required this.child});
  final SharedPreferences prefs;
  final Widget child;

  static Future<void> change(BuildContext context, WidgetRef ref, String? choice) async {
    final state = context.findAncestorStateOfType<_LanguageRootState>()!;
    await AppLang.save(state.widget.prefs, choice);
    // Emails and notifications follow the account's language. Best effort.
    if (ref.read(authControllerProvider) is Authenticated) {
      try {
        await ref.read(apiClientProvider).request<Object?>('PUT', '/users/me/locale', body: {'locale': AppLang.code});
      } on ApiException {
        // Kept locally; the account keeps its previous language.
      }
    }
    state.restart();
  }

  @override
  State<LanguageRoot> createState() => _LanguageRootState();
}

class _LanguageRootState extends State<LanguageRoot> {
  var _generation = 0;

  void restart() => setState(() => _generation++);

  @override
  Widget build(BuildContext context) => ProviderScope(
    key: ValueKey('${AppLang.code}-$_generation'),
    overrides: [sharedPreferencesProvider.overrideWithValue(widget.prefs)],
    child: widget.child,
  );
}

/// "Language" row with a picker: phone language, English or Urdu.
class LanguageTile extends ConsumerWidget {
  const LanguageTile({super.key});

  static String _label(String? choice) => switch (choice) {
    'en' => 'English',
    'ur' => 'اردو',
    _ => 'Phone language'.tr,
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) => ListTile(
    leading: const Icon(Icons.translate),
    title: Text('Language'.tr),
    subtitle: Text(_label(AppLang.choice)),
    trailing: const Icon(Icons.chevron_right),
    onTap: () async {
      final picked = await showModalBottomSheet<String>(
        context: context,
        showDragHandle: true,
        builder: (c) => SafeArea(
          child: RadioGroup<String>(
            groupValue: AppLang.choice ?? 'system',
            onChanged: (v) => Navigator.pop(c, v),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final v in ['system', 'en', 'ur'])
                  RadioListTile<String>(value: v, title: Text(_label(v == 'system' ? null : v))),
              ],
            ),
          ),
        ),
      );
      if (picked == null || !context.mounted) return;
      final choice = picked == 'system' ? null : picked;
      if (choice == AppLang.choice) return;
      await LanguageRoot.change(context, ref, choice);
    },
  );
}
