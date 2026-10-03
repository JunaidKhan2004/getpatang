import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/feedback.dart';
import '../application/auth_controller.dart';
import 'widgets/auth_scaffold.dart';

/// Cities offered first; the list is a convenience, not a restriction.
const pakistanCities = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Gujranwala',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Hyderabad',
  'Bahawalpur',
];

class CompleteProfileScreen extends ConsumerStatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  ConsumerState<CompleteProfileScreen> createState() => _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends ConsumerState<CompleteProfileScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _displayName;
  final _bio = TextEditingController();
  String? _city;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    final auth = ref.read(authControllerProvider);
    _displayName = TextEditingController(text: auth is Authenticated ? auth.user.fullName : '');
  }

  @override
  void dispose() {
    _displayName.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .saveProfile(displayName: _displayName.text.trim(), city: _city, bio: _bio.text.trim());
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => AuthScaffold(
    showBack: false,
    title: 'Set up your profile',
    subtitle: 'This is how shops, players and the community will see you.',
    child: Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _displayName,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            validator: (v) => Validators.name(v, 'Display name'),
            decoration: const InputDecoration(labelText: 'Display name', prefixIcon: Icon(Icons.badge_outlined)),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _city,
            items: [for (final c in pakistanCities) DropdownMenuItem(value: c, child: Text(c))],
            onChanged: (v) => setState(() => _city = v),
            validator: (v) => v == null ? 'Choose your city' : null,
            decoration: const InputDecoration(labelText: 'City', prefixIcon: Icon(Icons.location_on_outlined)),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _bio,
            maxLines: 3,
            maxLength: 160,
            decoration: const InputDecoration(labelText: 'Short bio (optional)', alignLabelWithHint: true),
          ),
          const SizedBox(height: 16),
          LoadingButton(label: 'Continue', loading: _loading, onPressed: _submit),
        ],
      ),
    ),
  );
}
