/// Build-time configuration. Pass values with --dart-define, e.g.
/// flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
abstract final class Env {
  /// 10.0.2.2 is the host machine from the Android emulator.
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:4000/api/v1');

  /// Public website, used to build links people share (e.g. a community post).
  static const webBaseUrl = String.fromEnvironment('WEB_BASE_URL', defaultValue: 'http://localhost:3000');
}
