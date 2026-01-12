# Flutter Client

Cross-platform Flutter app (Android/iOS/macOS/Web) that connects to the same server used by the web client.

## Features

- Auth (login/register), token persistence
- Conversations list and search
- End-to-end encrypted messages (direct & group)
- Audio/video calls (WebRTC)
- Socket updates for new messages and online users

## Requirements

- Flutter SDK 3.3+
- Running API server (see `apps/server`)
- Android: Android Studio + SDK, emulator or device

## Quick start

```
cd apps/flutter
flutter pub get
flutter run
```

## Build

Android (APK):

```
flutter build apk
```

Web:

```
flutter build web
```

## Configuration

Runtime endpoints are resolved by `AppConfig`:

- Debug defaults:
  - Android emulator: `http://10.0.2.2:3001`
  - macOS: `http://127.0.0.1:3001`
  - Others: `http://localhost:3001`
- Release defaults to `https://chat-server.peakol.top`

Override via `--dart-define`:

```
flutter run --dart-define=API_URL=http://localhost:3001 --dart-define=SOCKET_URL=http://localhost:3001
```

macOS specific overrides:

```
flutter run -d macos --dart-define=MAC_API_URL=http://127.0.0.1:3001 --dart-define=MAC_SOCKET_URL=http://127.0.0.1:3001
```

## Permissions

Android manifest already includes:

- `RECORD_AUDIO`
- `CAMERA`
- `MODIFY_AUDIO_SETTINGS`
- `INTERNET`

If you add Bluetooth audio routing, you may need `BLUETOOTH_CONNECT` on Android 12+.

## Notes

- Calls use default Google STUN servers. For TURN/STUN customization, update the ICE servers in `CallState`.
- Users must log in once on web or Flutter to publish identity keys before encrypted chat works across devices.
