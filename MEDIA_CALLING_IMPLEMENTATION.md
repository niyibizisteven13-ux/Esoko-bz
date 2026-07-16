# Media & Calling Features Implementation Guide

## Overview
This guide covers implementing voice calls, video calls, voice notes, and video notes for the trader chat system.

## Database Changes ✅

### New Tables Created:
1. **call_sessions** - Tracks all voice/video calls
   - id, conversationId, initiatorAccountNumber, recipientAccountNumber
   - callType (voice/video), status (ringing/active/completed/declined/missed)
   - duration, startedAt, endedAt, recordingUrl

2. **voice_notes** - Stores voice note metadata
   - id, conversationId, senderAccountNumber, recipientAccountNumber
   - audioUrl, duration (seconds), mimeType, fileSize
   - transcription (optional for future), status

3. **video_notes** - Stores video note metadata  
   - id, conversationId, senderAccountNumber, recipientAccountNumber
   - videoUrl, duration, thumbnailUrl, fileSize
   - transcription (optional for future), status

### Indexes Added:
- call_sessions: conversation, initiator, status
- voice_notes: conversation, sender
- video_notes: conversation, sender

---

## Part 1: Install Dependencies

```bash
npm install simple-peer \
  recordrtc \
  uuid

npm install --save-dev @types/simple-peer
```

**Key Libraries:**
- `simple-peer`: WebRTC P2P communication
- `recordrtc`: Audio/video recording (cross-browser)
- `uuid`: Generate unique IDs

---

## Part 2: Backend - Call Signaling Events (server.ts)

Add these Socket.io events after the existing chat listeners:

```typescript
// In the io.on('connection', (socket) => { ... }) block, add:

// ===== CALL SIGNALING EVENTS =====

// User initiates a call (voice or video)
socket.on('call:initiate', (data: { 
  conversationId: string; 
  recipientAccountNumber: string; 
  callType: 'voice' | 'video';
  offer: any; // WebRTC offer
}) => {
  try {
    const callSessionId = data.conversationId + '-' + Date.now();
    
    // Store call session in DB
    const stmt = db.prepare(`
      INSERT INTO call_sessions 
      (id, conversationId, initiatorAccountNumber, recipientAccountNumber, callType, status, metadata, startedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const initiatorAccount = socket.handshake.auth.accountNumber;
    stmt.run(
      callSessionId,
      data.conversationId,
      initiatorAccount,
      data.recipientAccountNumber,
      data.callType,
      'ringing',
      JSON.stringify({ webrtcOffer: data.offer }),
      new Date().toISOString()
    );
    
    // Send call to recipient
    io.to(data.recipientAccountNumber).emit('call:incoming', {
      sessionId: callSessionId,
      callType: data.callType,
      fromAccountNumber: initiatorAccount,
      offer: data.offer,
      conversationId: data.conversationId
    });
    
    logSystem(`Call initiated: ${callSessionId}`, 'info', 'call', initiatorAccount);
  } catch (error) {
    console.error('Call initiate error:', error);
    socket.emit('call:error', { message: 'Failed to initiate call' });
  }
});

// User answers a call
socket.on('call:answer', (data: {
  sessionId: string;
  answer: any; // WebRTC answer
}) => {
  try {
    const accountNumber = socket.handshake.auth.accountNumber;
    
    // Update call status
    db.prepare(`
      UPDATE call_sessions 
      SET status = 'active', metadata = ?
      WHERE id = ?
    `).run(
      JSON.stringify({ webrtcAnswer: data.answer }),
      data.sessionId
    );
    
    // Notify initiator
    const callSession = db.prepare(`
      SELECT * FROM call_sessions WHERE id = ?
    `).get(data.sessionId) as any;
    
    if (callSession) {
      io.to(callSession.initiatorAccountNumber).emit('call:answered', {
        sessionId: data.sessionId,
        answer: data.answer
      });
    }
    
    logSystem(`Call answered: ${data.sessionId}`, 'info', 'call', accountNumber);
  } catch (error) {
    console.error('Call answer error:', error);
  }
});

// Exchange ICE candidates
socket.on('call:ice-candidate', (data: {
  sessionId: string;
  candidate: any;
  to: string; // recipient account number
}) => {
  io.to(data.to).emit('call:ice-candidate', {
    sessionId: data.sessionId,
    candidate: data.candidate,
    from: socket.handshake.auth.accountNumber
  });
});

// Decline call
socket.on('call:decline', (data: { sessionId: string }) => {
  try {
    db.prepare(`
      UPDATE call_sessions 
      SET status = 'declined'
      WHERE id = ?
    `).run(data.sessionId);
    
    const callSession = db.prepare(`
      SELECT * FROM call_sessions WHERE id = ?
    `).get(data.sessionId) as any;
    
    if (callSession) {
      io.to(callSession.initiatorAccountNumber).emit('call:declined', {
        sessionId: data.sessionId
      });
    }
    
    logSystem(`Call declined: ${data.sessionId}`, 'info', 'call');
  } catch (error) {
    console.error('Call decline error:', error);
  }
});

// End call
socket.on('call:end', (data: { 
  sessionId: string;
  duration: number; // in seconds
}) => {
  try {
    db.prepare(`
      UPDATE call_sessions 
      SET status = 'completed', duration = ?, endedAt = ?
      WHERE id = ?
    `).run(data.duration, new Date().toISOString(), data.sessionId);
    
    const callSession = db.prepare(`
      SELECT * FROM call_sessions WHERE id = ?
    `).get(data.sessionId) as any;
    
    if (callSession) {
      // Notify the other participant
      const otherParty = callSession.initiatorAccountNumber === socket.handshake.auth.accountNumber
        ? callSession.recipientAccountNumber
        : callSession.initiatorAccountNumber;
      
      io.to(otherParty).emit('call:ended', {
        sessionId: data.sessionId,
        duration: data.duration
      });
    }
    
    logSystem(`Call ended: ${data.sessionId}, duration: ${data.duration}s`, 'info', 'call');
  } catch (error) {
    console.error('Call end error:', error);
  }
});
```

---

## Part 3: Backend - Voice/Video Note Upload Endpoints (server.ts)

Add these endpoints for uploading voice and video notes:

```typescript
// ===== VOICE NOTES ENDPOINT =====
app.post('/api/conversations/:id/voice-notes', authenticate, upload.single('audio'), 
  (req: Request, res: Response): any => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided' });
    }
    
    const conversationId = String(req.params.id);
    const chatAccountNumber = req.body.senderAccountNumber || req.user.appNumber;
    const recipientAccountNumber = req.body.recipientAccountNumber;
    const duration = parseInt(req.body.duration) || 0;
    
    // Validate conversation
    const conversation = db.prepare(`
      SELECT * FROM chat_conversations WHERE id = ?
    `).get(conversationId) as any;
    
    if (!conversation) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    
    const voiceNoteId = uuidv4();
    const audioUrl = `/uploads/${req.file.filename}`;
    
    // Insert voice note record
    db.prepare(`
      INSERT INTO voice_notes 
      (id, conversationId, senderAccountNumber, recipientAccountNumber, audioUrl, duration, mimeType, fileSize, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      voiceNoteId,
      conversationId,
      chatAccountNumber,
      recipientAccountNumber,
      audioUrl,
      duration,
      req.file.mimetype,
      req.file.size,
      'sent'
    );
    
    // Also create a chat message with voice note attachment
    const messageId = uuidv4();
    db.prepare(`
      INSERT INTO chat_messages 
      (id, conversationId, senderAccountNumber, recipientAccountNumber, attachmentType, attachmentName, attachmentMimeType, attachmentUrl, attachmentSize)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      messageId,
      conversationId,
      chatAccountNumber,
      recipientAccountNumber,
      'voice-note',
      `Voice Note (${duration}s)`,
      req.file.mimetype,
      audioUrl,
      req.file.size
    );
    
    // Broadcast via Socket.io
    const message = db.prepare(`
      SELECT * FROM chat_messages WHERE id = ?
    `).get(messageId) as any;
    
    io?.to(recipientAccountNumber).emit('new_message', {
      ...message,
      attachment: {
        type: 'voice-note',
        name: `Voice Note (${duration}s)`,
        meta: req.file.mimetype,
        url: audioUrl,
        size: req.file.size,
        duration
      }
    });
    
    res.json({
      success: true,
      id: voiceNoteId,
      messageId,
      message: {
        ...message,
        attachment: {
          type: 'voice-note',
          name: `Voice Note (${duration}s)`,
          meta: req.file.mimetype,
          url: audioUrl,
          size: req.file.size,
          duration
        }
      }
    });
  } catch (error: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== VIDEO NOTES ENDPOINT =====
app.post('/api/conversations/:id/video-notes', authenticate, upload.single('video'), 
  (req: Request, res: Response): any => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }
    
    const conversationId = String(req.params.id);
    const chatAccountNumber = req.body.senderAccountNumber || req.user.appNumber;
    const recipientAccountNumber = req.body.recipientAccountNumber;
    const duration = parseInt(req.body.duration) || 0;
    const thumbnailUrl = req.body.thumbnailUrl; // Optional thumbnail
    
    // Validate conversation
    const conversation = db.prepare(`
      SELECT * FROM chat_conversations WHERE id = ?
    `).get(conversationId) as any;
    
    if (!conversation) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    
    const videoNoteId = uuidv4();
    const videoUrl = `/uploads/${req.file.filename}`;
    
    // Insert video note record
    db.prepare(`
      INSERT INTO video_notes 
      (id, conversationId, senderAccountNumber, recipientAccountNumber, videoUrl, duration, mimeType, fileSize, thumbnailUrl, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      videoNoteId,
      conversationId,
      chatAccountNumber,
      recipientAccountNumber,
      videoUrl,
      duration,
      req.file.mimetype,
      req.file.size,
      thumbnailUrl || null,
      'sent'
    );
    
    // Also create a chat message
    const messageId = uuidv4();
    db.prepare(`
      INSERT INTO chat_messages 
      (id, conversationId, senderAccountNumber, recipientAccountNumber, attachmentType, attachmentName, attachmentMimeType, attachmentUrl, attachmentSize)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      messageId,
      conversationId,
      chatAccountNumber,
      recipientAccountNumber,
      'video-note',
      `Video Note (${duration}s)`,
      req.file.mimetype,
      videoUrl,
      req.file.size
    );
    
    // Broadcast via Socket.io
    const message = db.prepare(`
      SELECT * FROM chat_messages WHERE id = ?
    `).get(messageId) as any;
    
    io?.to(recipientAccountNumber).emit('new_message', {
      ...message,
      attachment: {
        type: 'video-note',
        name: `Video Note (${duration}s)`,
        meta: req.file.mimetype,
        url: videoUrl,
        thumbnailUrl,
        size: req.file.size,
        duration
      }
    });
    
    res.json({
      success: true,
      id: videoNoteId,
      messageId,
      message: {
        ...message,
        attachment: {
          type: 'video-note',
          name: `Video Note (${duration}s)`,
          meta: req.file.mimetype,
          url: videoUrl,
          thumbnailUrl,
          size: req.file.size,
          duration
        }
      }
    });
  } catch (error: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== GET CALL HISTORY =====
app.get('/api/conversations/:id/calls', authenticate, (req: Request, res: Response): any => {
  try {
    const conversationId = String(req.params.id);
    const { limit = 50, offset = 0 } = req.query;
    
    const calls = db.prepare(`
      SELECT * FROM call_sessions 
      WHERE conversationId = ?
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `).all(conversationId, limit, offset) as any[];
    
    res.json({ success: true, calls });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## Part 4: Frontend - Chat Service (src/services/chatService.ts)

Add these functions to handle voice/video note uploads:

```typescript
// Add to chatService.ts

export async function uploadVoiceNote(
  conversationId: string,
  audioBlob: Blob,
  duration: number,
  recipientAccountNumber: string
): Promise<{ messageId: string; message: ChatMessageShape }> {
  const formData = new FormData();
  formData.append('audio', audioBlob, `voice-${Date.now()}.mp3`);
  formData.append('duration', duration.toString());
  formData.append('recipientAccountNumber', recipientAccountNumber);
  
  const response = await apiClient.post(
    `/api/conversations/${conversationId}/voice-notes`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' }
    }
  );
  
  return {
    messageId: response.data.messageId,
    message: normalizeChatMessage(response.data.message)
  };
}

export async function uploadVideoNote(
  conversationId: string,
  videoBlob: Blob,
  duration: number,
  recipientAccountNumber: string,
  thumbnail?: string
): Promise<{ messageId: string; message: ChatMessageShape }> {
  const formData = new FormData();
  formData.append('video', videoBlob, `video-${Date.now()}.mp4`);
  formData.append('duration', duration.toString());
  formData.append('recipientAccountNumber', recipientAccountNumber);
  if (thumbnail) {
    formData.append('thumbnailUrl', thumbnail);
  }
  
  const response = await apiClient.post(
    `/api/conversations/${conversationId}/video-notes`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' }
    }
  );
  
  return {
    messageId: response.data.messageId,
    message: normalizeChatMessage(response.data.message)
  };
}

export async function getCallHistory(conversationId: string): Promise<any[]> {
  const response = await apiClient.get(`/api/conversations/${conversationId}/calls`);
  return response.data.calls || [];
}
```

---

## Part 5: Frontend - Components

### Audio Recorder Hook

Create `src/hooks/useAudioRecorder.ts`:

```typescript
import { useRef, useState } from 'react';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';

interface RecorderState {
  isRecording: boolean;
  duration: number;
  audioBlob: Blob | null;
}

export function useAudioRecorder() {
  const recorderRef = useRef<RecordRTC | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    duration: 0,
    audioBlob: null
  });

  const startRecording = async () => {
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      recorderRef.current = new RecordRTC(mediaStreamRef.current, {
        type: 'audio',
        mimeType: 'audio/mp3',
        recorderType: StereoAudioRecorder
      });
      
      recorderRef.current.startRecording();
      setState(prev => ({ ...prev, isRecording: true, duration: 0 }));
      
      // Update duration
      const durationInterval = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      
      return () => clearInterval(durationInterval);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!recorderRef.current) {
        resolve(null);
        return;
      }

      recorderRef.current.stopRecording(async () => {
        const blob = recorderRef.current!.getBlob();
        setState(prev => ({ ...prev, isRecording: false, audioBlob: blob }));
        
        // Clean up
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        
        resolve(blob);
      });
    });
  };

  const reset = () => {
    setState({ isRecording: false, duration: 0, audioBlob: null });
  };

  return { ...state, startRecording, stopRecording, reset };
}
```

### Video Recorder Hook

Create `src/hooks/useVideoRecorder.ts`:

```typescript
import { useRef, useState } from 'react';

interface VideoRecorderState {
  isRecording: boolean;
  duration: number;
  videoBlob: Blob | null;
  preview: string | null;
}

export function useVideoRecorder() {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const [state, setState] = useState<VideoRecorderState>({
    isRecording: false,
    duration: 0,
    videoBlob: null,
    preview: null
  });

  const startRecording = async () => {
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true
      });

      mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current, {
        mimeType: 'video/mp4'
      });

      videoChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start();
      setState(prev => ({ ...prev, isRecording: true, duration: 0 }));

      // Update duration
      const durationInterval = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      return () => clearInterval(durationInterval);
    } catch (error) {
      console.error('Failed to start video recording:', error);
    }
  };

  const stopRecording = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: 'video/mp4' });
        setState(prev => ({ ...prev, isRecording: false, videoBlob: blob }));
        
        // Create preview
        const preview = URL.createObjectURL(blob);
        setState(prev => ({ ...prev, preview }));
        
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  };

  const reset = () => {
    setState({ isRecording: false, duration: 0, videoBlob: null, preview: null });
  };

  return { ...state, startRecording, stopRecording, reset };
}
```

---

## Next Steps

1. **Install dependencies**: Run `npm install simple-peer recordrtc uuid`
2. **Add backend endpoints**: Copy the Socket.io events and HTTP endpoints to server.ts
3. **Add chat service functions**: Update chatService.ts with upload functions
4. **Create UI components**: Build recording and call interface components
5. **Test**: Start with voice notes, then video notes, then calling

---

## Architecture Overview

```
User A (Caller)              User B (Receiver)
    │                              │
    ├─ Initiates Voice Call ──────►│
    │  (Socket.io: call:initiate)  │
    │                    Ring Sound │
    │                              │
    │◄─ User B Answers ────────────┤
    │  (Socket.io: call:answer)    │
    │                              │
    ├────── WebRTC P2P Audio ──────┤
    ├─── Exchange ICE Candidates ──┤
    │     (Direct peer connection) │
    │                              │
    └─ Call Ends ─────────────────►│
       Update DB: call_sessions    │
```

---

## Database Queries Reference

```typescript
// Get recent calls for a conversation
SELECT * FROM call_sessions 
WHERE conversationId = ? 
ORDER BY createdAt DESC 
LIMIT 20;

// Get voice notes from user
SELECT * FROM voice_notes 
WHERE senderAccountNumber = ? 
ORDER BY createdAt DESC;

// Get total call duration by user
SELECT 
  initiatorAccountNumber,
  COUNT(*) as call_count,
  SUM(duration) as total_duration
FROM call_sessions 
WHERE status = 'completed'
GROUP BY initiatorAccountNumber;
```

