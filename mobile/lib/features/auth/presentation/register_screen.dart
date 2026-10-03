import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/feedback.dart';
import '../application/auth_controller.dart';
import '../data/auth_models.dart';
import 'widgets/auth_scaffold.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _acceptedTerms = false;
  bool _loading = false;
  Map<String, String> _serverErrors = {};

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _password, _confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _serverErrors = {});
    if (!_form.currentState!.validate()) return;
    if (!_acceptedTerms) {
      showToast(context, 'Please accept the Terms and Privacy Policy to continue.', kind: ToastKind.error);
      return;
    }
    setState(() => _loading = true);
    try {
      final email = _email.text.trim();
      await ref
          .read(authControllerProvider.notifier)
          .register(
            fullName: _name.text.trim(),
            email: email,
            phone: _phone.text.replaceAll(RegExp(r'[\s-]'), ''),
            password: _password.text,
          );
      if (!mounted) return;
      context.push('/verify-otp?email=${Uri.encodeComponent(email)}&purpose=${OtpPurpose.verifyAccount.value}');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _serverErrors = e.fieldErrors);
      _form.currentState!.validate();
      showToast(context, e.message, kind: ToastKind.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? Function(String?) _withServer(String field, String? Function(String?) local) =>
      (v) => local(v) ?? _serverErrors[field];

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return AuthScaffold(
      title: 'Create your account',
      subtitle: 'We will send a 6-digit code to your email to verify it.',
      child: Form(
        key: _form,
        child: AutofillGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.name],
                validator: _withServer('fullName', (v) => Validators.name(v, 'Full name')),
                decoration: const InputDecoration(labelText: 'Full name', prefixIcon: Icon(Icons.person_outline)),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                validator: _withServer('email', Validators.email),
                decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline)),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.telephoneNumber],
                validator: _withServer('phone', Validators.optionalPhone),
                decoration: const InputDecoration(
                  labelText: 'Mobile number (optional)',
                  hintText: '03XX XXXXXXX',
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
              ),
              const SizedBox(height: 16),
              PasswordField(
                controller: _password,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.newPassword],
                validator: _withServer('password', Validators.password),
              ),
              const SizedBox(height: 16),
              PasswordField(
                controller: _confirm,
                label: 'Confirm password',
                autofillHints: const [AutofillHints.newPassword],
                validator: Validators.confirm(() => _password.text),
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Checkbox(value: _acceptedTerms, onChanged: (v) => setState(() => _acceptedTerms = v ?? false)),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text.rich(
                        TextSpan(
                          style: t.textTheme.bodySmall,
                          children: [
                            const TextSpan(text: 'I agree to the '),
                            TextSpan(
                              text: 'Terms',
                              style: TextStyle(color: t.colorScheme.primary, fontWeight: FontWeight.w600),
                              recognizer: TapGestureRecognizer()..onTap = () => context.push('/legal/terms'),
                            ),
                            const TextSpan(text: ' and '),
                            TextSpan(
                              text: 'Privacy Policy',
                              style: TextStyle(color: t.colorScheme.primary, fontWeight: FontWeight.w600),
                              recognizer: TapGestureRecognizer()..onTap = () => context.push('/legal/privacy'),
                            ),
                            const TextSpan(text: ', and confirm I will follow local kite-flying laws.'),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              LoadingButton(label: 'Create account', loading: _loading, onPressed: _submit),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('Already registered?'),
                  TextButton(onPressed: () => context.go('/login'), child: const Text('Sign in')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
