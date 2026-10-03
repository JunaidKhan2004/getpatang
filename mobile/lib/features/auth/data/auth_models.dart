class UserProfile {
  const UserProfile({required this.displayName, this.city, this.bio, this.avatarUrl});

  final String displayName;
  final String? city;
  final String? bio;
  final String? avatarUrl;

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
    displayName: json['displayName'] as String,
    city: json['city'] as String?,
    bio: json['bio'] as String?,
    avatarUrl: json['avatarUrl'] as String?,
  );
}

class AppUser {
  const AppUser({
    required this.id,
    required this.fullName,
    required this.email,
    required this.roles,
    required this.isVerified,
    this.phone,
    this.profile,
  });

  final String id;
  final String fullName;
  final String email;
  final String? phone;
  final List<String> roles;
  final bool isVerified;
  final UserProfile? profile;

  bool get needsProfile => profile == null;
  bool hasRole(String role) => roles.contains(role);

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
    id: json['id'] as String,
    fullName: json['fullName'] as String,
    email: json['email'] as String,
    phone: json['phone'] as String?,
    roles: (json['roles'] as List).cast<String>(),
    isVerified: json['isVerified'] as bool,
    profile: json['profile'] == null ? null : UserProfile.fromJson(json['profile'] as Map<String, dynamic>),
  );
}

/// Purpose of a one-time code. Must match the backend `OtpPurpose` enum.
enum OtpPurpose {
  verifyAccount('VERIFY_ACCOUNT'),
  resetPassword('RESET_PASSWORD');

  const OtpPurpose(this.value);
  final String value;

  static OtpPurpose parse(String? v) =>
      OtpPurpose.values.firstWhere((p) => p.value == v, orElse: () => OtpPurpose.verifyAccount);
}
