import { useCallback, useEffect, useRef, useState } from 'react';

export type CallState = 'idle' | 'calling' | 'connected' | 'failed' | 'ended';

interface UseWebRTCCallOptions {
    socket: WebSocket | null;
    accountNumber: string;
}

interface IncomingOfferPayload {
    conversationId: string;
    fromAccountNumber: string;
    sdp: RTCSessionDescriptionInit;
    callType: 'voice' | 'video';
}

// For pure LAN use (no internet), a public STUN server won't be reachable.
// Two devices on the same LAN often connect fine via host ICE candidates
// alone without STUN/TURN, but this needs verifying on the real network —
// see the note in the prompt this code came with.
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function useWebRTCCall({ socket, accountNumber }: UseWebRTCCallOptions) {
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [callState, setCallState] = useState<CallState>('idle');
    const [callType, setCallType] = useState<'voice' | 'video'>('voice');
    const [peerAccountNumber, setPeerAccountNumber] = useState<string | null>(null);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [failReason, setFailReason] = useState<string | null>(null);

    function createPeerConnection(conversationId: string, toAccountNumber: string) {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pc.ontrack = (event) => setRemoteStream(event.streams[0]);
        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.send(JSON.stringify({
                    type: 'call_ice_candidate',
                    conversationId,
                    toAccountNumber,
                    candidate: event.candidate,
                }));
            }
        };
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') setCallState('connected');
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                setCallState('failed');
            }
        };
        return pc;
    }

    const startCall = useCallback(async (conversationId: string, toAccountNumber: string, type: 'voice' | 'video') => {
        if (!socket) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
            localStreamRef.current = stream;
            setLocalStream(stream);
            setCallType(type);
            setPeerAccountNumber(toAccountNumber);
            setActiveConversationId(conversationId);

            const pc = createPeerConnection(conversationId, toAccountNumber);
            pcRef.current = pc;
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.send(JSON.stringify({
                type: 'call_offer',
                conversationId,
                toAccountNumber,
                sdp: offer,
                callType: type,
            }));
            setCallState('calling');
        } catch (err) {
            console.error('[useWebRTCCall] failed to start call', err);
            setCallState('failed');
            setFailReason('Could not access camera/microphone.');
        }
    }, [socket]);

    const handleIncomingOffer = useCallback(async (payload: IncomingOfferPayload) => {
        if (!socket) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: payload.callType === 'video' });
            localStreamRef.current = stream;
            setLocalStream(stream);
            setCallType(payload.callType);
            setPeerAccountNumber(payload.fromAccountNumber);
            setActiveConversationId(payload.conversationId);

            const pc = createPeerConnection(payload.conversationId, payload.fromAccountNumber);
            pcRef.current = pc;
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.send(JSON.stringify({
                type: 'call_answer',
                conversationId: payload.conversationId,
                toAccountNumber: payload.fromAccountNumber,
                sdp: answer,
            }));
            setCallState('calling'); // becomes 'connected' via onconnectionstatechange once ICE completes
        } catch (err) {
            console.error('[useWebRTCCall] failed to answer incoming call', err);
            setCallState('failed');
            setFailReason('Could not access camera/microphone.');
        }
    }, [socket]);

    const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
    }, []);

    const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
        if (!pcRef.current) return;
        try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            console.error('[useWebRTCCall] failed to add ICE candidate', err);
        }
    }, []);

    const handleRemoteEnd = useCallback(() => {
        teardown();
        setCallState('ended');
    }, []);

    const handleRemoteFailed = useCallback((reason: string) => {
        teardown();
        setCallState('failed');
        setFailReason(reason);
    }, []);

    function teardown() {
        pcRef.current?.close();
        pcRef.current = null;
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        setRemoteStream(null);
    }

    const endCall = useCallback(() => {
        if (socket && activeConversationId && peerAccountNumber) {
            socket.send(JSON.stringify({
                type: 'call_end',
                conversationId: activeConversationId,
                toAccountNumber: peerAccountNumber,
            }));
        }
        teardown();
        setCallState('idle');
        setPeerAccountNumber(null);
        setActiveConversationId(null);
        setFailReason(null);
    }, [socket, activeConversationId, peerAccountNumber]);

    const toggleMute = useCallback(() => {
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = !audioTrack.enabled;
        return audioTrack ? !audioTrack.enabled : false; // returns whether now muted
    }, []);

    return {
        callState,
        callType,
        localStream,
        remoteStream,
        peerAccountNumber,
        activeConversationId,
        failReason,
        startCall,
        handleIncomingOffer,
        handleAnswer,
        handleIceCandidate,
        handleRemoteEnd,
        handleRemoteFailed,
        endCall,
        toggleMute,
    };
}
