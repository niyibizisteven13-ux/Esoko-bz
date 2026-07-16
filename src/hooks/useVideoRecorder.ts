import { useRef, useState, useCallback } from 'react';

interface VideoRecorderState {
  isRecording: boolean;
  duration: number;
  videoBlob: Blob | null;
  preview: string | null;
}

export function useVideoRecorder() {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [state, setState] = useState<VideoRecorderState>({
    isRecording: false,
    duration: 0,
    videoBlob: null,
    preview: null
  });

  const startRecording = useCallback(async () => {
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true
      });

      mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current, {
        mimeType: 'video/webm'
      });

      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start();
      setState(prev => ({ ...prev, isRecording: true, duration: 0, videoBlob: null, preview: null }));

      // Update duration every second
      durationIntervalRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } catch (error) {
      console.error('Failed to start video recording:', error);
      setState(prev => ({ ...prev, isRecording: false }));
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const preview = URL.createObjectURL(blob);
        
        setState(prev => ({ ...prev, isRecording: false, videoBlob: blob, preview }));
        
        // Clean up stream
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
        
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const reset = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    if (state.preview) {
      URL.revokeObjectURL(state.preview);
    }
    setState({ isRecording: false, duration: 0, videoBlob: null, preview: null });
  }, [state.preview]);

  return { ...state, startRecording, stopRecording, reset };
}
