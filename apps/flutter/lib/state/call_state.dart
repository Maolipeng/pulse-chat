import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../services/socket_service.dart';
import 'auth_state.dart';

class CallState extends ChangeNotifier {
  CallState({required this.authState, required this.socketService}) {
    socketService.addListener(_handleSocketChange);
    _initializeRenderers();
  }

  final AuthState authState;
  final SocketService socketService;

  String callState = 'idle';
  String callPeer = '';
  String callType = 'audio';
  String callNotice = '';
  bool localMicOn = true;
  bool localVideoOn = false;
  bool remoteVideoOn = false;
  bool canFlipCamera = false;

  final RTCVideoRenderer localRenderer = RTCVideoRenderer();
  final RTCVideoRenderer remoteRenderer = RTCVideoRenderer();

  MediaStream? _localStream;
  MediaStream? _remoteStream;
  RTCPeerConnection? _peerConnection;
  Map<String, dynamic>? _incomingOffer;
  io.Socket? _socket;

  bool get showVideoPanel => callState != 'idle' && (callType == 'video' || localVideoOn);

  Future<void> _initializeRenderers() async {
    await localRenderer.initialize();
    await remoteRenderer.initialize();
  }

  Future<void> startCall(String peer, {String type = 'audio'}) async {
    if (callState != 'idle' || peer.isEmpty || _socket == null) return;
    callNotice = '';
    callPeer = peer;
    callType = type;
    callState = 'calling';
    notifyListeners();

    try {
      await _prepareOutgoingMedia(type);
      _socket?.emit('call:invite', {'to': peer, 'type': type});
    } catch (error) {
      callNotice = 'Unable to start the call: ${error.toString()}';
      _resetCallState();
    }
  }

  Future<void> acceptCall() async {
    if (_incomingOffer == null || _socket == null) return;
    callNotice = '';
    final from = _incomingOffer?['from']?.toString() ?? '';
    final type = _incomingOffer?['type']?.toString() ?? 'audio';
    final sdp = _incomingOffer?['sdp'];
    if (from.isEmpty) return;
    callPeer = from;
    callType = type;
    _incomingOffer = null;

    if (sdp == null) {
      try {
        await _prepareOutgoingMedia(type);
        callState = 'connecting';
        notifyListeners();
        _socket?.emit('call:accept', {'to': from});
        return;
      } catch (error) {
        callNotice = 'Microphone/camera permission denied.';
        _resetCallState();
        return;
      }
    }

    await _handleIncomingOffer(from, sdp, type);
  }

  void rejectCall() {
    if (_incomingOffer != null && _socket != null) {
      _socket?.emit('call:reject', {'to': _incomingOffer?['from']});
    }
    callNotice = 'Call rejected.';
    _incomingOffer = null;
    _resetCallState();
  }

  void cancelCall() {
    if (_socket != null && callPeer.isNotEmpty) {
      _socket?.emit('call:reject', {'to': callPeer});
    }
    callNotice = 'Call canceled.';
    _resetCallState();
  }

  void endCall() {
    if (_socket != null && callPeer.isNotEmpty) {
      _socket?.emit('call:end', {'to': callPeer});
    }
    _resetCallState();
  }

  void toggleMic() {
    if (_localStream == null) return;
    final track = _localStream!.getAudioTracks().firstOrNull;
    if (track == null) return;
    track.enabled = !track.enabled;
    localMicOn = track.enabled;
    notifyListeners();
  }

  Future<void> toggleCamera() async {
    if (_localStream == null) return;
    final track = _localStream!.getVideoTracks().isNotEmpty
        ? _localStream!.getVideoTracks().first
        : null;
    if (track == null) {
      await enableCamera();
      return;
    }
    track.enabled = !track.enabled;
    localVideoOn = track.enabled;
    notifyListeners();
  }

  Future<void> enableCamera() async {
    if (_localStream == null || _peerConnection == null) return;
    final videoStream = await navigator.mediaDevices.getUserMedia({
      'video': true,
      'audio': false,
    });
    final newTrack = videoStream.getVideoTracks().first;
    _localStream!.addTrack(newTrack);
    await _peerConnection!.addTrack(newTrack, _localStream!);
    localRenderer.srcObject = _localStream;
    localVideoOn = true;
    canFlipCamera = true;
    notifyListeners();

    final offer = await _peerConnection!.createOffer(_offerConstraints());
    await _peerConnection!.setLocalDescription(offer);
    _socket?.emit('call:offer', {
      'to': callPeer,
      'sdp': offer.toMap(),
      'type': callType,
    });
  }

  Future<void> switchCamera() async {
    final track = _localStream?.getVideoTracks().firstOrNull;
    if (track == null) return;
    await Helper.switchCamera(track);
  }

  void _handleSocketChange() {
    final socket = socketService.socket;
    if (_socket == socket) return;

    if (_socket != null) {
      _socket?.off('call:invite');
      _socket?.off('call:accept');
      _socket?.off('call:offer');
      _socket?.off('call:answer');
      _socket?.off('call:ice');
      _socket?.off('call:reject');
      _socket?.off('call:busy');
      _socket?.off('call:unavailable');
      _socket?.off('call:end');
    }

    _socket = socket;
    if (_socket == null) {
      _resetCallState();
      return;
    }

    _socket?.on('call:invite', (payload) {
      final from = payload['from']?.toString() ?? '';
      final type = payload['type']?.toString() ?? 'audio';
      if (callState != 'idle' && callPeer != from) {
        _socket?.emit('call:reject', {'to': from});
        return;
      }
      callPeer = from;
      callType = type;
      _incomingOffer = {'from': from, 'type': type};
      callState = 'ringing';
      notifyListeners();
    });

    _socket?.on('call:accept', (payload) async {
      final from = payload['from']?.toString() ?? '';
      if (from.isEmpty || callPeer != from) return;
      try {
        await _ensurePeerConnection(from, callType == 'video');
        final offer = await _peerConnection!.createOffer(_offerConstraints());
        await _peerConnection!.setLocalDescription(offer);
        _socket?.emit('call:offer', {
          'to': from,
          'sdp': offer.toMap(),
          'type': callType,
        });
        callState = 'connecting';
        notifyListeners();
      } catch (error) {
        callNotice = 'Unable to start the call: ${error.toString()}';
        _resetCallState();
      }
    });

    _socket?.on('call:offer', (payload) async {
      final from = payload['from']?.toString() ?? '';
      final sdp = payload['sdp'];
      final type = payload['type']?.toString() ?? callType;
      if (from.isEmpty || sdp == null) return;

      if (callState != 'idle' && callPeer != from) {
        _socket?.emit('call:reject', {'to': from});
        return;
      }

      callPeer = from;
      callType = type;
      _incomingOffer = {'from': from, 'sdp': sdp, 'type': type};
      if (callState == 'connecting') {
        await _handleIncomingOffer(from, sdp, type);
        return;
      }

      callState = 'ringing';
      notifyListeners();
    });

    _socket?.on('call:answer', (payload) async {
      final from = payload['from']?.toString() ?? '';
      final sdp = payload['sdp'];
      if (from.isEmpty || sdp == null || _peerConnection == null) return;
      if (callPeer != from) return;
      await _peerConnection!.setRemoteDescription(
        RTCSessionDescription(sdp['sdp'], sdp['type']),
      );
      callState = 'in-call';
      notifyListeners();
    });

    _socket?.on('call:ice', (payload) async {
      final from = payload['from']?.toString() ?? '';
      final candidate = payload['candidate'];
      if (from.isEmpty || candidate == null || _peerConnection == null) return;
      await _peerConnection!.addCandidate(RTCIceCandidate(
        candidate['candidate'],
        candidate['sdpMid'],
        candidate['sdpMLineIndex'],
      ));
    });

    _socket?.on('call:reject', (payload) {
      final from = payload['from']?.toString() ?? '';
      if (from.isEmpty || callPeer != from) return;
      callNotice = '$from rejected the call.';
      _resetCallState();
    });

    _socket?.on('call:busy', (payload) {
      final to = payload['to']?.toString() ?? '';
      if (to.isEmpty || callPeer != to) return;
      callNotice = '$to is busy.';
      _resetCallState();
    });

    _socket?.on('call:unavailable', (payload) {
      final to = payload['to']?.toString() ?? '';
      if (to.isEmpty || callPeer != to) return;
      callNotice = '$to is unavailable.';
      _resetCallState();
    });

    _socket?.on('call:end', (payload) {
      final from = payload['from']?.toString() ?? '';
      if (from.isEmpty || callPeer != from) return;
      callNotice = 'Call ended by $from.';
      _resetCallState();
    });
  }

  Future<void> _handleIncomingOffer(String from, dynamic sdp, String type) async {
    try {
      await _ensurePeerConnection(from, type == 'video');
      final description = _parseSessionDescription(sdp);
      await _peerConnection!.setRemoteDescription(description);
      final answer = await _peerConnection!.createAnswer(_offerConstraints());
      await _peerConnection!.setLocalDescription(answer);
      _socket?.emit('call:answer', {'to': from, 'sdp': answer.toMap()});
      callState = 'in-call';
      notifyListeners();
    } catch (error) {
      callNotice = 'Unable to start the call: ${error.toString()}';
      _resetCallState();
    }
  }

  RTCSessionDescription _parseSessionDescription(dynamic raw) {
    if (raw is RTCSessionDescription) return raw;
    if (raw is Map) {
      final sdp = raw['sdp']?.toString();
      final type = raw['type']?.toString();
      if (sdp == null || type == null) {
        throw StateError('Invalid SDP payload');
      }
      return RTCSessionDescription(sdp, type);
    }
    throw StateError('Unsupported SDP payload');
  }

  Map<String, dynamic> _offerConstraints() {
    return {
      'offerToReceiveAudio': 1,
      'offerToReceiveVideo': 1,
    };
  }

  Future<void> _prepareOutgoingMedia(String type) async {
    if (_localStream != null) return;
    final wantsVideo = type == 'video';
    try {
      final stream = await navigator.mediaDevices.getUserMedia({
        'audio': true,
        'video': wantsVideo,
      });
      _attachLocalStream(stream);
    } catch (error) {
      if (!wantsVideo) {
        callNotice = _formatMediaError(error, wantsVideo: false);
        rethrow;
      }
      callNotice = _formatMediaError(error, wantsVideo: true);
      try {
        final stream = await navigator.mediaDevices.getUserMedia({'audio': true});
        _attachLocalStream(stream);
      } catch (audioError) {
        callNotice = _formatMediaError(audioError, wantsVideo: false);
        rethrow;
      }
    }
  }

  void _attachLocalStream(MediaStream stream) {
    _localStream = stream;
    localRenderer.srcObject = stream;
    localVideoOn = stream.getVideoTracks().isNotEmpty;
    localMicOn = stream.getAudioTracks().firstOrNull?.enabled ?? true;
    canFlipCamera = stream.getVideoTracks().isNotEmpty;
    notifyListeners();
  }

  String _formatMediaError(Object error, {required bool wantsVideo}) {
    final message = error.toString().toLowerCase();
    final isPermission = message.contains('permission') ||
        message.contains('not allowed') ||
        message.contains('denied');
    if (wantsVideo) {
      if (isPermission) {
        return 'Camera permission denied. Receiving audio only.';
      }
      return 'Camera unavailable. Receiving audio only.';
    }
    if (isPermission) {
      return 'Microphone permission denied.';
    }
    return 'Microphone unavailable.';
  }

  Future<void> _ensurePeerConnection(String peer, bool wantsVideo) async {
    if (_peerConnection != null) return;
    final config = {
      'sdpSemantics': 'unified-plan',
      'iceServers': [
        {
          'urls': ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
        }
      ]
    };
    _peerConnection = await createPeerConnection(config);

    _peerConnection?.onIceCandidate = (candidate) {
      if (candidate == null) return;
      _socket?.emit('call:ice', {
        'to': peer,
        'candidate': candidate.toMap(),
      });
    };

    _peerConnection?.onTrack = (event) {
      if (event.streams.isEmpty) return;
      _remoteStream = event.streams[0];
      remoteRenderer.srcObject = _remoteStream;
      remoteVideoOn = _remoteStream!.getVideoTracks().isNotEmpty;
      notifyListeners();
    };

    if (_localStream == null) {
      try {
        await _prepareOutgoingMedia(wantsVideo ? 'video' : 'audio');
      } catch (_) {
        _resetCallState();
        rethrow;
      }
    }

    if (_localStream != null) {
      try {
        for (final track in _localStream!.getTracks()) {
          await _peerConnection!.addTrack(track, _localStream!);
        }
      } catch (_) {
        _resetCallState();
        rethrow;
      }
    }
  }

  void _resetCallState() {
    _incomingOffer = null;
    callState = 'idle';
    callPeer = '';
    callType = 'audio';
    localVideoOn = false;
    remoteVideoOn = false;
    localMicOn = true;
    canFlipCamera = false;
    _peerConnection?.close();
    _peerConnection = null;
    _localStream?.getTracks().forEach((track) => track.stop());
    _localStream = null;
    _remoteStream?.getTracks().forEach((track) => track.stop());
    _remoteStream = null;
    localRenderer.srcObject = null;
    remoteRenderer.srcObject = null;
    notifyListeners();
  }

  @override
  void dispose() {
    socketService.removeListener(_handleSocketChange);
    _peerConnection?.close();
    localRenderer.dispose();
    remoteRenderer.dispose();
    super.dispose();
  }
}

extension _ListExt<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
