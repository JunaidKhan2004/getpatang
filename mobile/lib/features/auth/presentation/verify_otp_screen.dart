import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/feedback.dart';
import '../application/auth_controller.dart';
import '../data/auth_models.dart';
import 'widgets/auth_scaffold.dart';

/// Verifies a 6-digit code. For [OtpPurpose.resetPassword] it hands the code to the reset screen
/// (the backend checks it together with the new password).
class VerifyOtpScreen extends ConsumerStatefulWidget {
  const VerifyOtpScreen({super.key, required this.email, required this.purpose});

  final String email;
  final OtpPurpose purpose;

  @override
  ConsumerState<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends ConsumerState<VerifyOtpScreen> {
  static const _resendSeconds = 60;

  final _form = GlobalKey<FormState>();
  final _code = TextEditingController();
  bool _loading = false;
  int _cooldown = _resendSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startCooldown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _startCooldown() {
    _timer?.cancel();
    setState(() => _cooldown = _resendSeconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_cooldown <= 1) t.cancel();
      setState(() => _cooldown--);
    });
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (widget.purpose == OtpPurpose.resetPassword) {
      context.push('/reset-password?email=${Uri.encodeComponent(widget.email)}&code=${_code.text}');
      return;
    }
    setState(() => _loading = true);
    try {
      await ref.read(authControllerProvider.notifier).verifyAccount(widget.email, _code.text);
      if (mounted) showToast(context, 'Email verified. Welcome!', kind: ToastKind.success);
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resend() async {
    try {
      await ref.read(authControllerProvider.notifier).resendOtp(widget.email, widget.purpose);
      if (!mounted) return;
      showToast(context, 'A new code has been sent.', kind: ToastKind.success);
      _startCooldown();
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, kind: ToastKind.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return AuthScaffold(
      title: 'Enter verification code',
      subtitle: 'We sent a 6-digit code to ${widget.email}. It expires in 10 minutes.',
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: _code,
              autofocus: true,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              maxLength: 6,
              autofillHints: const [AutofillHints.oneTimeCode],
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: t.textTheme.headlineMedium?.copyWith(letterSpacing: 14),
              validator: Validators.otp,
              onChanged: (v) {
                if (v.length == 6) _submit();
              },
              decoration: const InputDecoration(counterText: '', hintText: '••••••'),
            ),
            const SizedBox(height: 24),
            LoadingButton(label: 'Verify', loading: _loading, onPressed: _submit),
            const SizedBox(height: 12),
            TextButton(
              onPressed: _cooldown > 0 ? null : _resend,
              child: Text(_cooldown > 0 ? 'Resend code in ${_cooldown}s' : 'Resend code'),
            ),
          ],
        ),
      ),
    );
  }
}
