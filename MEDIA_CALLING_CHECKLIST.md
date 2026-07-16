# ✅ Media & Calling Features - Implementation Checklist

## Phase 1: Setup ✓ DONE
- [x] Database schema created (call_sessions, voice_notes, video_notes)
- [x] Attachment normalization applied to frontend (CustomerDashboard.tsx)
- [x] Comprehensive implementation guide created (MEDIA_CALLING_IMPLEMENTATION.md)

---

## Phase 2: Backend Setup (Copy from MEDIA_CALLING_IMPLEMENTATION.md)

### Dependencies Installation
```bash
npm install simple-peer recordrtc uuid
npm install --save-dev @types/simple-peer
```
- [ ] Run npm install command
- [ ] Verify installation success

### Add to server.ts - Call Signaling Events (~line 14300+)
- [ ] Copy `call:initiate` event handler
- [ ] Copy `call:answer` event handler
- [ ] Copy `call:ice-candidate` event handler
- [ ] Copy `call:decline` event handler
- [ ] Copy `call:end` event handler

### Add to server.ts - Upload Endpoints (~line 1100-1250)
- [ ] Copy POST `/api/conversations/:id/voice-notes` endpoint
- [ ] Copy POST `/api/conversations/:id/video-notes` endpoint
- [ ] Copy GET `/api/conversations/:id/calls` endpoint

---

## Phase 3: Frontend - Chat Service

### Add to src/services/chatService.ts
- [ ] Copy `uploadVoiceNote()` function
- [ ] Copy `uploadVideoNote()` function
- [ ] Copy `getCallHistory()` function
- [ ] Update normalizeChatMessage() if needed

---

## Phase 4: Frontend - Recorder Hooks

### Create src/hooks/useAudioRecorder.ts
- [ ] Copy audio recorder hook implementation
- [ ] Verify RecordRTC import works
- [ ] Test startRecording()
- [ ] Test stopRecording()
- [ ] Test reset()

### Create src/hooks/useVideoRecorder.ts
- [ ] Copy video recorder hook implementation
- [ ] Verify MediaRecorder API works
- [ ] Test startRecording()
- [ ] Test stopRecording()
- [ ] Test preview generation

---

## Phase 5: Frontend - UI Components

### Create src/components/VoiceRecorder.tsx
- [ ] Mic icon button in chat input
- [ ] Live duration counter
- [ ] Record/Stop button states
- [ ] Audio playback preview
- [ ] Send button for voice note
- [ ] Error handling for permissions

### Create src/components/VideoRecorder.tsx
- [ ] Video camera icon button
- [ ] Live video preview in recorder
- [ ] Duration counter
- [ ] Record/Stop button states
- [ ] Video preview with thumbnail
- [ ] Send button for video note
- [ ] Permission request handling

### Create src/components/CallInterface.tsx
- [ ] Call initiation button (voice + video)
- [ ] Incoming call modal/popup
- [ ] Accept/Decline call buttons
- [ ] Local video element
- [ ] Remote video element
- [ ] Audio/video toggles
- [ ] End call button
- [ ] Call duration display
- [ ] Call history list

---

## Phase 6: Integration with Existing Components

### Update TraderChat.tsx or ChatInput.tsx
- [ ] Add VoiceRecorder component to message input
- [ ] Add VideoRecorder component to message input
- [ ] Add CallInterface component to conversation view
- [ ] Import useAudioRecorder hook
- [ ] Import useVideoRecorder hook

### Update Message Rendering in TraderChat.tsx
- [ ] Add handler for attachment.type === 'voice-note'
  ```typescript
  if (m.attachment?.type === 'voice-note') {
    return <AudioPlayer src={m.attachment.url} duration={m.attachment.duration} />;
  }
  ```
- [ ] Add handler for attachment.type === 'video-note'
  ```typescript
  if (m.attachment?.type === 'video-note') {
    return <VideoPlayer src={m.attachment.url} thumbnail={m.attachment.thumbnailUrl} />;
  }
  ```
- [ ] Verify image thumbnail rendering still works
- [ ] Verify file card rendering still works

---

## Phase 7: Testing

### Voice Notes Testing
- [ ] User A records 5-second voice note
- [ ] User A sends voice note
- [ ] User B receives notification
- [ ] User B can play voice note
- [ ] Audio quality is acceptable
- [ ] Refresh page - voice note still visible
- [ ] Voice note appears in call history

### Video Notes Testing
- [ ] User A records 10-second video note
- [ ] User A sends video note
- [ ] User B receives notification
- [ ] User B can play video note
- [ ] Video quality is acceptable
- [ ] Thumbnail displays correctly
- [ ] Refresh page - video note still visible

### Calling Testing
- [ ] User A initiates voice call to User B
- [ ] User B receives call notification
- [ ] User B can accept call
- [ ] Audio transmits both directions
- [ ] Call duration updates
- [ ] User A can end call
- [ ] Call is recorded in database
- [ ] Repeat for video calling

### Cross-Browser Testing
- [ ] Test on Chrome (desktop)
- [ ] Test on Firefox (desktop)
- [ ] Test on Safari (desktop)
- [ ] Test on Chrome (mobile)
- [ ] Test on Safari (mobile)
- [ ] Verify permission prompts work
- [ ] Verify audio/video permissions persist

### Database Testing
```bash
# Verify tables exist
sqlite3 data/esoko.db ".tables" | grep -E "call|voice|video"

# Check call records
sqlite3 data/esoko.db "SELECT COUNT(*) FROM call_sessions;"

# Check voice notes
sqlite3 data/esoko.db "SELECT COUNT(*) FROM voice_notes;"

# Check video notes
sqlite3 data/esoko.db "SELECT COUNT(*) FROM video_notes;"
```

---

## Phase 8: Optimization & Polish

### Performance
- [ ] Implement audio/video compression
- [ ] Add progress bar for uploads
- [ ] Show file size before sending
- [ ] Implement bandwidth monitoring
- [ ] Cache recent calls/notes

### UX Improvements
- [ ] Add loading states during recording
- [ ] Show connection quality during calls
- [ ] Display call declined reasons
- [ ] Add missed call notifications
- [ ] Show recording time limits/warnings
- [ ] Add undo for accidental stops

### Accessibility
- [ ] Add keyboard shortcuts (e.g., Space for record)
- [ ] Add ARIA labels
- [ ] Test screen reader compatibility
- [ ] Ensure color contrast in UI

### Security
- [ ] Validate file types on backend
- [ ] Set file size limits
- [ ] Sanitize metadata
- [ ] Rate limit uploads
- [ ] Add malware scanning hooks

---

## Reference Files

| File | Purpose | Status |
|------|---------|--------|
| MEDIA_CALLING_IMPLEMENTATION.md | Complete guide with code | ✅ Created |
| db.ts | Database schema | ✅ Updated |
| server.ts | Backend endpoints | ⏳ Pending |
| chatService.ts | Frontend API client | ⏳ Pending |
| useAudioRecorder.ts | Audio hook | ⏳ Pending |
| useVideoRecorder.ts | Video hook | ⏳ Pending |
| VoiceRecorder.tsx | UI component | ⏳ Pending |
| VideoRecorder.tsx | UI component | ⏳ Pending |
| CallInterface.tsx | Calling UI | ⏳ Pending |
| TraderChat.tsx | Integration | ⏳ Pending |

---

## Quick Copy-Paste Sections

All code is in: `MEDIA_CALLING_IMPLEMENTATION.md`

### Backend
```bash
# Add these sections to server.ts:
# - Part 2: Call Signaling Events (~50 lines)
# - Part 3: Voice/Video Upload Endpoints (~100 lines)
```

### Frontend
```bash
# Add these functions to chatService.ts:
# - uploadVoiceNote()
# - uploadVideoNote()
# - getCallHistory()
```

### New Files (3 hooks + 3 components)
```bash
# Create new files:
# src/hooks/useAudioRecorder.ts
# src/hooks/useVideoRecorder.ts
# src/components/VoiceRecorder.tsx
# src/components/VideoRecorder.tsx
# src/components/CallInterface.tsx
```

---

## Timeline Estimate

- Phase 2 (Backend): 30 minutes
- Phase 3 (Chat Service): 15 minutes
- Phase 4 (Hooks): 20 minutes
- Phase 5 (Components): 45 minutes
- Phase 6 (Integration): 30 minutes
- Phase 7 (Testing): 1-2 hours
- **Total: ~3-4 hours**

---

## Rollback Instructions

If you need to revert:

```bash
# Undo server.ts changes
git checkout server.ts

# Undo db.ts changes
git checkout db.ts

# Delete new files
rm src/hooks/useAudioRecorder.ts
rm src/hooks/useVideoRecorder.ts
rm src/components/VoiceRecorder.tsx
rm src/components/VideoRecorder.tsx
rm src/components/CallInterface.tsx

# Undo chatService.ts changes
git checkout src/services/chatService.ts

# Restart server
npm run dev
```

---

## Support References

- **WebRTC**: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
- **MediaRecorder**: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- **RecordRTC**: https://github.com/muaz-khan/RecordRTC
- **simple-peer**: https://github.com/feross/simple-peer
- **Socket.io**: https://socket.io/docs/

---

Status: **Database & Documentation Complete - Ready for Backend Implementation**

Last Updated: 2026-07-14
