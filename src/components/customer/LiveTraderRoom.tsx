import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  CameraOff,
  MessageCircle,
  Mic,
  MicOff,
  Phone,
  Radio,
  Send,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { auth } from '../../firebase';
import { addDoc, collection, serverTimestamp } from '../../services/firestoreBridge';
import { subscribeToLiveUpdates } from '../../services/liveSyncService';

const db = undefined;

interface LiveTraderRoomProps {
  trader?: any;
  product?: any;
  products?: any[];
  session?: any;
  onClose: () => void;
  onBuy?: (product: any) => void;
}

interface ChatMessage {
  id: string;
  sender: 'customer' | 'trader';
  text: string;
  createdAt: string;
}

export default function LiveTraderRoom({
  trader,
  product,
  products = [],
  session,
  onClose,
  onBuy,
}: LiveTraderRoomProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const viewerIdRef = useRef(`viewer-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const signalCursorRef = useRef('');
  const [cameraOn, setCameraOn] = useState(false);
  const [watching, setWatching] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [chatText, setChatText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'trader',
      text: `Welcome to ${session?.title || trader?.businessName || trader?.name || product?.traderName || 'this shop'}. Ask for price, size, delivery, or a live demo.`,
      createdAt: new Date().toISOString(),
    },
  ]);

  const featuredProducts =
    product || products.length === 0 ? [product].filter(Boolean) : products.slice(0, 4);
  const traderName =
    session?.businessName ||
    session?.traderName ||
    trader?.businessName ||
    trader?.name ||
    product?.traderName ||
    'Live trader';

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      peerRef.current?.close();
      if (session?.id) {
        void fetch(`/api/live/sessions/${session.id}/participants/me`, {
          method: 'DELETE',
          credentials: 'include',
          keepalive: true,
        });
      }
    };
  }, [session?.id]);

  const postSignal = useCallback(
    async (type: string, payload: any) => {
      if (!session?.id) return;
      await fetch(`/api/live/sessions/${session.id}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, payload, viewerId: viewerIdRef.current }),
      });
    },
    [session?.id]
  );

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (peerRef.current && !cameraOn) {
        peerRef.current.close();
        peerRef.current = null;
        setWatching(false);
        setRemoteConnected(false);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraOn(true);
      setMicOn(true);
      if (session?.id) await startLiveCall(stream);
    } catch (error) {
      setCameraError(
        error instanceof Error ? error.message : 'Camera or microphone permission was blocked.'
      );
    }
  };

  const startWatching = async () => {
    setCameraError(null);
    try {
      await startLiveCall();
      setWatching(true);
    } catch (error) {
      setCameraError(
        error instanceof Error ? error.message : 'Could not connect to the live trader video.'
      );
    }
  };

  const startLiveCall = async (stream?: MediaStream) => {
    if (!session?.id || peerRef.current) return;
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    peerRef.current = peer;
    stream?.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        setRemoteConnected(true);
      }
    };
    peer.onicecandidate = (event) => {
      if (event.candidate) postSignal('candidate', event.candidate.toJSON());
    };
    const offer = await peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await peer.setLocalDescription(offer);
    await postSignal('offer', offer);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    peerRef.current?.close();
    peerRef.current = null;
    setCameraOn(false);
    setWatching(false);
    setRemoteConnected(false);
  };

  const toggleMic = () => {
    const next = !micOn;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicOn(next);
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: 'customer',
        text,
        createdAt: new Date().toISOString(),
      },
    ]);
    if (session?.id) {
      void fetch(`/api/live/sessions/${session.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text }),
      });
    } else if (trader?.id || product?.traderId) {
      try {
        await addDoc(collection(db, 'messages'), {
          traderId: trader?.id || product?.traderId,
          channel: 'general',
          text,
          senderId: auth.currentUser?.uid,
          createdBy: auth.currentUser?.uid,
          senderName: auth.currentUser?.displayName || 'Customer',
          source: 'marketplace-live-room',
          productId: product?.id || null,
          productName: product?.name || null,
          timestamp: serverTimestamp(),
        });
      } catch (error) {
        console.error('Failed to send marketplace message:', error);
      }
    }
    setChatText('');
  };

  const loadLiveMessages = useCallback(async () => {
    if (!session?.id) return;
    const res = await fetch(`/api/live/sessions/${session.id}/messages?limit=80`, {
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = await res.json();
    const liveMessages = (data.messages || []).map((item: any) => ({
      id: item.id,
      sender: item.userId === (session?.traderId || trader?.id) ? 'trader' : 'customer',
      text: `${item.senderName || 'Guest'}: ${item.message}`,
      createdAt: item.createdAt,
    })) as ChatMessage[];
    if (liveMessages.length) setMessages((prev) => [prev[0], ...liveMessages]);
  }, [session?.id, session?.traderId, trader?.id]);

  useEffect(() => {
    if (!session?.id) return;
    const joinRoom = async () => {
      await fetch(`/api/live/sessions/${session.id}/participants`, {
        method: 'POST',
        credentials: 'include',
      });
    };
    joinRoom();
    loadLiveMessages();
    const interval = window.setInterval(loadLiveMessages, 1000);
    const unsubscribe = subscribeToLiveUpdates((event) => {
      if (event.collection === 'live_messages' && event.path?.includes(`/api/live/sessions/${session.id}/messages`)) {
        void loadLiveMessages();
      }
    });
    return () => {
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [session?.id, loadLiveMessages]);

  useEffect(() => {
    if (!session?.id || peerRef.current) return;
    void startWatching();
  }, [session?.id]);

  useEffect(() => {
    if (!session?.id) return;
    const loadParticipants = async () => {
      await fetch(`/api/live/sessions/${session.id}/participants`, {
        method: 'POST',
        credentials: 'include',
      });
      const res = await fetch(`/api/live/sessions/${session.id}/participants`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      setParticipants(data.participants || []);
    };
    loadParticipants();
    const interval = window.setInterval(loadParticipants, 5000);
    return () => window.clearInterval(interval);
  }, [session?.id]);

  useEffect(() => {
    if (!session?.id) return;
    const interval = window.setInterval(async () => {
      const query = new URLSearchParams({ viewerId: viewerIdRef.current });
      if (signalCursorRef.current) query.set('after', signalCursorRef.current);
      const res = await fetch(`/api/live/sessions/${session.id}/signals?${query}`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      for (const signal of data.signals || []) {
        signalCursorRef.current = signal.createdAt;
        const peer = peerRef.current;
        if (!peer) continue;
        if (signal.type === 'answer' && !peer.currentRemoteDescription) {
          await peer.setRemoteDescription(signal.payload);
        }
        if (signal.type === 'candidate' && peer.remoteDescription) {
          await peer.addIceCandidate(signal.payload);
        }
      }
    }, 1500);
    return () => window.clearInterval(interval);
  }, [session?.id]);

  return (
    <div className="fixed inset-0 z-[140] bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 md:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 24 }}
        className="w-full max-w-6xl h-[92vh] rounded-[2rem] bg-[#050505] border border-white/10 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_360px]"
      >
        <div className="relative bg-black min-h-[360px]">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={cn('w-full h-full object-cover', !remoteConnected && 'hidden')}
          />
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              'absolute bottom-24 right-5 w-36 h-48 rounded-3xl object-cover border border-white/20 shadow-2xl bg-black',
              !cameraOn && 'hidden',
              !remoteConnected && 'w-full h-full rounded-none inset-0 border-0'
            )}
          />

          {!watching && !cameraOn && !remoteConnected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
              <div className="w-24 h-24 rounded-[2rem] bg-orange-600/15 border border-orange-500/20 text-orange-500 flex items-center justify-center mb-5">
                <Radio size={44} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 mb-3">
                Live Trading Room
              </p>
              <h3 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                {traderName}
              </h3>
              <p className="mt-4 max-w-md text-sm text-neutral-400 font-medium leading-relaxed">
                Start camera and microphone to join the live trader call. When the trader accepts,
                both sides can see and hear each other.
              </p>
              {cameraError && (
                <p className="mt-4 max-w-md rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-bold text-red-400">
                  {cameraError}
                </p>
              )}
              {session?.id && (
                <button
                  type="button"
                  onClick={startWatching}
                  className="mt-5 rounded-2xl bg-red-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-red-900/40 hover:bg-red-700"
                >
                  Watch trader live
                </button>
              )}
            </div>
          )}

          {(watching || cameraOn) && !remoteConnected && session?.id && (
            <div className="absolute inset-x-0 top-24 mx-auto max-w-md rounded-2xl bg-black/70 border border-white/10 p-4 text-center">
              <p className="text-sm font-black text-white">Waiting for trader video...</p>
              <p className="text-xs text-neutral-400 mt-1">
                Keep this room open while the trader accepts your live call.
              </p>
            </div>
          )}

          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-black/60 backdrop-blur border border-white/10 px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">
                Live shop
              </span>
              <span className="text-[10px] font-bold text-neutral-400 flex items-center gap-1">
                <Users size={12} /> {participants.length || session?.participantCount || 1}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-3 rounded-2xl bg-black/60 text-white border border-white/10 hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-[1.5rem] bg-black/70 backdrop-blur border border-white/10 p-3">
            <button
              type="button"
              onClick={cameraOn || watching ? stopCamera : startCamera}
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all',
                cameraOn || watching
                  ? 'bg-white/10 hover:bg-red-600'
                  : 'bg-orange-600 hover:bg-orange-700'
              )}
            >
              {cameraOn || watching ? <CameraOff size={20} /> : <Camera size={20} />}
            </button>
            {watching && !cameraOn && (
              <button
                type="button"
                onClick={startCamera}
                className="h-12 rounded-2xl bg-blue-600 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-700"
              >
                Join camera
              </button>
            )}
            <button
              type="button"
              onClick={toggleMic}
              disabled={!cameraOn}
              className="w-12 h-12 rounded-2xl bg-white/10 disabled:opacity-40 text-white flex items-center justify-center hover:bg-white/15 transition-all"
            >
              {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            {(trader?.phone || trader?.phoneNumber) && (
              <a
                href={`tel:${trader.phone || trader.phoneNumber}`}
                className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-all"
              >
                <Phone size={20} />
              </a>
            )}
          </div>
        </div>

        <aside className="bg-[#0a0a0a] border-l border-white/5 flex flex-col min-h-0">
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20 flex items-center justify-center">
                <MessageCircle size={22} />
              </div>
              <div>
                <h4 className="font-black text-white leading-tight">Live chat and buying</h4>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                  Self-contained room
                </p>
              </div>
            </div>
            {participants.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {participants.slice(0, 8).map((participant) => (
                  <span
                    key={participant.id || participant.userId}
                    className="rounded-full bg-white/5 border border-white/5 px-3 py-1 text-[10px] font-bold text-neutral-300"
                  >
                    {participant.role === 'trader' ? 'Host: ' : ''}
                    {participant.displayName || 'Guest'}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 space-y-3 border-b border-white/5 max-h-52 overflow-y-auto">
            {featuredProducts.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-white/5 border border-white/5 p-3 flex items-center gap-3"
              >
                <div className="w-14 h-14 rounded-xl bg-black overflow-hidden flex items-center justify-center text-neutral-700">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ShoppingBag size={22} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate">{item.name}</p>
                  <p className="text-xs font-black text-orange-500">
                    {formatCurrency(Number(item.price || 0))} RWF
                  </p>
                </div>
                {onBuy && (
                  <button
                    type="button"
                    disabled={item.stock <= 0}
                    onClick={() => onBuy(item)}
                    className="px-3 py-2 rounded-xl bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                  >
                    Buy
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  message.sender === 'customer' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-xs font-bold leading-relaxed',
                    message.sender === 'customer'
                      ? 'bg-orange-600 text-white'
                      : 'bg-white/5 text-neutral-300 border border-white/5'
                  )}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-white/5 flex gap-2">
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Ask about price, size, stock, delivery..."
              className="flex-1 min-w-0 rounded-2xl bg-black border border-white/10 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-neutral-700"
            />
            <button
              type="submit"
              className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700"
            >
              <Send size={18} />
            </button>
          </form>
        </aside>
      </motion.div>
    </div>
  );
}
