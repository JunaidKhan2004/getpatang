import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/feedback.dart';
import '../application/auth_controller.dart';
import '../data/auth_models.dart';
import 'widgets/auth_scaffold.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await ref.read(authControllerProvider.notifier).login(_identifier.text.trim(), _password.text);
      // Router redirect takes over once authenticated.
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'ACCOUNT_NOT_VERIFIED') {
        final email = Uri.encodeComponent(_identifier.text.trim());
        context.push('/verify-otp?email=$email&purpose=${OtpPurpose.verifyAccount.value}');
        showToast(context, e.message);
      } else {
        showToast(context, e.message, kind: ToastKind.error);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Welcome back',
      subtitle: 'Sign in to manage your orders, tournaments and shop.',
      child: Form(
        key: _form,
        child: AutofillGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _identifier,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email, AutofillHints.telephoneNumber],
                validator: (v) => Validators.required(v, 'Email or phone'),
                decoration: const InputDecoration(labelText: 'Email or phone', prefixIcon: Icon(Icons.alternate_email)),
              ),
              const SizedBox(height: 16),
              PasswordField(
                controller: _password,
                validator: (v) => Validators.required(v, 'Password'),
                onSubmitted: (_) => _submit(),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => context.push('/forgot-password'),
                  child: const Text('Forgot password?'),
                ),
              ),
              const SizedBox(height: 8),
              LoadingButton(label: 'Sign in', loading: _loading, onPressed: _submit),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('New here?'),
                  TextButton(onPressed: () => context.go('/register'), child: const Text('Create an account')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
