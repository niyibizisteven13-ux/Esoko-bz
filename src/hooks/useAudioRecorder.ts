import { useRef, useState, useCallback } from 'react';

interface RecorderState {
  isRecording: boolean;
  duration: number;
  audioBlob: Blob | null;
}

export function useAudioRecorder() {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    duration: 0,
    audioBlob: null
  });

  const startRecording = useCallback(async () => {
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current, {
        mimeType: 'audio/mp3'
      });
      
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.start();
      setState(prev => ({ ...prev, isRecording: true, duration: 0, audioBlob: null }));
      
      // Update duration every second
      durationIntervalRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
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
        const blob = new Blob(chunksRef.current, { type: 'audio/mp3' });
        setState(prev => ({ ...prev, isRecording: false, audioBlob: blob }));
        
        // Clean up
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
    setState({ isRecording: false, duration: 0, audioBlob: null });
  }, []);

  return { ...state, startRecording, stopRecording, reset };
}
