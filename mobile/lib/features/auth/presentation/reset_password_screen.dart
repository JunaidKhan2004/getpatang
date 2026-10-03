import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/feedback.dart';
import '../application/auth_controller.dart';
import 'widgets/auth_scaffold.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key, required this.email, required this.code});

  final String email;
  final String code;

  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await ref.read(authControllerProvider.notifier).resetPassword(widget.email, widget.code, _password.text);
      if (!mounted) return;
      showToast(context, 'Password updated. Sign in with your new password.', kind: ToastKind.success);
      context.go('/login');
    } on ApiException catch (e) {
      if (!mounted) return;
      showToast(context, e.message, kind: ToastKind.error);
      // A wrong or expired code means the user must request a new one.
      if (e.code == 'OTP_INVALID' || e.code == 'OTP_EXPIRED') context.pop();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => AuthScaffold(
    title: 'Choose a new password',
    subtitle: 'Use at least 8 characters with a letter and a number. You will be signed out on other devices.',
    child: Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PasswordField(
            controller: _password,
            label: 'New password',
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.newPassword],
            validator: Validators.password,
          ),
          const SizedBox(height: 16),
          PasswordField(
            controller: _confirm,
            label: 'Confirm new password',
            autofillHints: const [AutofillHints.newPassword],
            validator: Validators.confirm(() => _password.text),
            onSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: 24),
          LoadingButton(label: 'Update password', loading: _loading, onPressed: _submit),
        ],
      ),
    ),
  );
}
