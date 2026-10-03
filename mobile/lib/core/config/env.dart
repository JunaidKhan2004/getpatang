/// Build-time configuration. Release builds pass real addresses with --dart-define (docs/DEPLOYMENT.md).
abstract final class Env {
  /// Development default. 127.0.0.1 on the phone or emulator reaches this computer's API once
  /// `adb reverse` is set up: VS Code does it before launching ("GetPatang app (local API)"),
  /// or run mobile/tool/connect-devices.ps1.
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://127.0.0.1:4000/api/v1');

  /// Public website, used to build links people share (e.g. a community post).
  static const webBaseUrl = String.fromEnvironment('WEB_BASE_URL', defaultValue: 'http://localhost:3000');
}
