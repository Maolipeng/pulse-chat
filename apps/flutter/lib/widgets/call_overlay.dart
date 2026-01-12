import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:provider/provider.dart';

import '../state/call_state.dart';
import '../theme.dart';
import 'avatar_utils.dart';
import 'soft_card.dart';

class CallOverlay extends StatelessWidget {
  const CallOverlay({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<CallState>(
      builder: (context, call, _) {
        if (call.callState == 'idle' || call.callState == 'ringing') {
          return const SizedBox.shrink();
        }

        if (call.showVideoPanel) {
          return _VideoCallOverlay(call: call);
        }

        return _AudioCallOverlay(call: call);
      },
    );
  }
}

class _VideoCallOverlay extends StatelessWidget {
  const _VideoCallOverlay({required this.call});

  final CallState call;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Container(
        color: Colors.black,
        child: Stack(
          children: [
            RTCVideoView(
              call.remoteRenderer,
              objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
            ),
            if (!call.remoteVideoOn)
              Center(
                child: Text(
                  getInitials(call.callPeer.isEmpty ? 'Remote' : call.callPeer),
                  style: const TextStyle(
                    fontSize: 40,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            Positioned(
              top: 60,
              right: 20,
              child: SizedBox(
                width: 100,
                height: 140,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    color: Colors.black54,
                    child: RTCVideoView(
                      call.localRenderer,
                      mirror: true,
                      objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                    ),
                  ),
                ),
              ),
            ),
            _CallControls(call: call, dark: true),
          ],
        ),
      ),
    );
  }
}

class _AudioCallOverlay extends StatelessWidget {
  const _AudioCallOverlay({required this.call});

  final CallState call;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0E1F28), Color(0xFF1A2E3A)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SoftCard(
              padding: const EdgeInsets.all(24),
              child: Text(
                getInitials(call.callPeer.isEmpty ? 'Call' : call.callPeer),
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textMain,
                    ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              call.callPeer.isEmpty ? 'Unknown' : call.callPeer,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: Colors.white,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              _statusText(call.callState),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white70,
                  ),
            ),
            const SizedBox(height: 40),
            _CallControls(call: call, dark: true),
          ],
        ),
      ),
    );
  }

  String _statusText(String state) {
    switch (state) {
      case 'calling':
        return 'Calling...';
      case 'connecting':
        return 'Connecting...';
      case 'in-call':
        return 'Connected';
      default:
        return '';
    }
  }
}

class _CallControls extends StatelessWidget {
  const _CallControls({required this.call, required this.dark});

  final CallState call;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      bottom: 40,
      left: 0,
      right: 0,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _ControlButton(
            icon: call.localMicOn ? Icons.mic_rounded : Icons.mic_off_rounded,
            onPressed: call.toggleMic,
            active: call.localMicOn,
            dark: dark,
          ),
          const SizedBox(width: 16),
          if (call.showVideoPanel)
            _ControlButton(
              icon: call.localVideoOn ? Icons.videocam_rounded : Icons.videocam_off_rounded,
              onPressed: call.toggleCamera,
              active: call.localVideoOn,
              dark: dark,
            ),
          if (call.canFlipCamera && call.showVideoPanel)
            Padding(
              padding: const EdgeInsets.only(left: 16),
              child: _ControlButton(
                icon: Icons.cameraswitch_rounded,
                onPressed: call.switchCamera,
                active: true,
                dark: dark,
              ),
            ),
          const SizedBox(width: 16),
          _ControlButton(
            icon: Icons.call_end_rounded,
            onPressed: call.endCall,
            active: true,
            danger: true,
            dark: dark,
          ),
        ],
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  const _ControlButton({
    required this.icon,
    required this.onPressed,
    required this.active,
    required this.dark,
    this.danger = false,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final bool active;
  final bool dark;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final background = danger
        ? const Color(0xFFE94848)
        : active
            ? (dark ? Colors.white24 : Colors.white)
            : (dark ? Colors.white12 : const Color(0xFFEAF0F6));
    final foreground = danger
        ? Colors.white
        : active
            ? (dark ? Colors.white : AppTheme.textMain)
            : (dark ? Colors.white70 : AppTheme.textMuted);
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(24),
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Icon(icon, color: foreground),
      ),
    );
  }
}

class IncomingCallModal extends StatelessWidget {
  const IncomingCallModal({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<CallState>(
      builder: (context, call, _) {
        if (call.callState != 'ringing') {
          return const SizedBox.shrink();
        }
        return Positioned.fill(
          child: Container(
            color: Colors.black45,
            alignment: Alignment.center,
            child: SoftCard(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Incoming ${call.callType} call',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          letterSpacing: 2.5,
                          color: AppTheme.accentDark,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    call.callPeer.isEmpty ? 'Unknown' : call.callPeer,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ElevatedButton(
                        onPressed: call.rejectCall,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppTheme.textMain,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        child: const Text('Reject'),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton(
                        onPressed: call.acceptCall,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.accent,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        child: const Text('Accept'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
