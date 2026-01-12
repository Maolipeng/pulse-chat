class AppUser {
  final String id;
  final String username;

  AppUser({required this.id, required this.username});

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
      };
}
