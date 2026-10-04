import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/feedback.dart';
import '../application/auth_controller.dart';
import '../data/auth_models.dart';
import 'widgets/auth_scaffold.dart';
import '../../../core/i18n/i18n.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _loading = true);
    final email = _email.text.trim();
    try {
      await ref.read(authControllerProvider.notifier).forgotPassword(email);
      if (!mounted) return;
      context.push('/verify-otp?email=${Uri.encodeComponent(email)}&purpose=${OtpPurpose.resetPassword.value}');
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => AuthScaffold(
    title: 'Reset your password'.tr,
    subtitle: 'Enter the email on your account. If it exists, we will send a reset code.'.tr,
    child: Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            validator: Validators.email,
            onFieldSubmitted: (_) => _submit(),
            decoration: InputDecoration(labelText: 'Email'.tr, prefixIcon: const Icon(Icons.mail_outline)),
          ),
          const SizedBox(height: 24),
          LoadingButton(label: 'Send reset code'.tr, loading: _loading, onPressed: _submit),
        ],
      ),
    ),
  );
}
