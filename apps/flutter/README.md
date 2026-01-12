# Flutter Client

This is the cross-platform Flutter client. The UI is styled to match the soft, neumorphic look in the provided reference.

## Features covered

- Auth (login/register), token persistence
- Conversations list and search
- End-to-end encrypted messages (direct & group)
- Audio/video calls (WebRTC)
- Socket updates for new messages and online users

Notes: calls use default Google STUN servers. If you need TURN/STUN customization, wire it into `CallState` ICE servers.

If you chat with older users, they must log in once on web or Flutter to publish their identity key.

## Run

```bash
cd apps/flutter
flutter pub get
flutter run
```

## Build (web)

```bash
cd apps/flutter
flutter build web
```

## Configure API/Socket endpoints

Use compile-time envs if needed:

```bash
flutter run --dart-define=API_URL=http://localhost:3001 --dart-define=SOCKET_URL=http://localhost:3001
```

For macOS-specific overrides:

```bash
flutter run -d macos --dart-define=MAC_API_URL=http://127.0.0.1:3001 --dart-define=MAC_SOCKET_URL=http://127.0.0.1:3001
```
