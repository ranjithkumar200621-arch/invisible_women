'use client';

import { useState, useCallback } from 'react';
import type { ConversationState } from '../types/conversation';
import type { TurnInput } from '../types/api';
import type { ApiError } from '../types/api';

interface ChatResponse {
  response: string;
  state: ConversationState;
  status: 'needs_information' | 'eligible' | 'not_eligible' | 'undetermined';
  eligibilityResult?: any;
  nextField?: string;
}

interface UseConversationReturn {
  state: ConversationState | null;
  stateSnapshot: ConversationState | null;
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
  currentStep: string;
  language: string;
  voice: {
    isListening: boolean;
    isSpeaking: boolean;
    isThinking: boolean;
  };
  error: ApiError | null;
  setStatus: (status: 'listening' | 'speaking' | 'thinking' | 'idle') => void;
  sendInput: (input: TurnInput) => Promise<void>;
  startListening: (onTranscript: (transcript: string) => void) => Promise<void>;
  stopListening: () => void;
  speak: (text: string, language: string) => Promise<void>;
  stopSpeaking: () => void;
  initializeSession: () => Promise<void>;
  getAudioContext: () => AudioContext | null;
}

// Export single AudioContext instance
let audioContext: AudioContext | null = null;
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let audioElement: HTMLAudioElement | null = null;
let currentSessionId: string | null = null;
let hasSessionStarted: boolean = false;

export function useConversation(): UseConversationReturn {
  const [state, setState] = useState<ConversationState | null>(null);
  const [stateSnapshot, setStateSnapshot] = useState<ConversationState | null>(null);
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [language, setLanguage] = useState('ta');
  const [voice, setVoice] = useState({
    isListening: false,
    isSpeaking: false,
    isThinking: false,
  });
  const [error, setError] = useState<ApiError | null>(null);

  const setStatus = useCallback((status: 'listening' | 'speaking' | 'thinking' | 'idle') => {
    setVoice((prev) => ({
      ...prev,
      isListening: status === 'listening',
      isSpeaking: status === 'speaking',
      isThinking: status === 'thinking',
    }));
  }, []);

  const initializeSession = useCallback(async () => {
    try {
      if (hasSessionStarted) return; // Prevent duplicate initialization
      
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      currentSessionId = sessionId;
      hasSessionStarted = true;

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });

      if (response.ok) {
        const result = await response.json();
        const data = result.data;

        setState(data.state);
        setStateSnapshot(data.state);
        // Note: Don't add welcome message to history here to prevent duplicates
        // The Gemini conversation layer handles conversation flow
      }
    } catch (err) {
      console.error('Session initialization error:', err);
      setError({
        code: 'INVALID_INPUT',
        message: err instanceof Error ? err.message : 'Failed to initialize session',
        retryable: true,
      });
    }
  }, [language]);

  const startListening = useCallback(async (onTranscript: (transcript: string) => void) => {
    setStatus('listening');
    await startRecording(onTranscript);
  }, [setStatus]);

  const startRecording = useCallback(async (onTranscript: (transcript: string) => void) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data as Blob);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioBuffer = await audioBlob.arrayBuffer();
        const base64 = await arrayBufferToBase64(audioBuffer);

        try {
          const response = await fetch('/api/speech/asr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64,
              languageCode: language,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setStatus('idle');
            onTranscript(data.transcript);
          } else {
            setStatus('idle');
            onTranscript('');
          }
        } catch (err) {
          console.error('ASR error:', err);
          setStatus('idle');
          onTranscript('');
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.error('Microphone access error:', err);
      setStatus('idle');
      onTranscript('');
    }
  }, [language, setStatus]);

  const stopListening = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }, [setStatus]);

  const speak = useCallback(async (text: string, lang: string) => {
    setStatus('speaking');

    try {
      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      const preferredVoice = voices.find(v =>
        v.lang.includes(lang === 'ta' ? 'ta' : lang === 'hi' ? 'hi' : 'en')
      );

      if (synth && preferredVoice) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = preferredVoice;
        utterance.lang = lang === 'ta' ? 'ta-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
        utterance.onstart = () => setStatus('speaking');
        utterance.onend = () => setStatus('idle');
        synth.speak(utterance);
        return;
      }

      const response = await fetch('/api/speech/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          languageCode: lang,
        }),
      });

      if (!response.ok) {
        throw new Error('TTS failed');
      }

      const data = await response.json();
      audioElement = new Audio(`data:${data.mimeType};base64,${data.audioBase64}`);
      audioElement.onended = () => setStatus('idle');
      audioElement.onerror = () => setStatus('idle');
      await audioElement.play();
    } catch (err) {
      console.error('Speak error:', err);
      setStatus('idle');
    }
  }, [setStatus]);

  const stopSpeaking = useCallback(() => {
    if (audioElement) {
      audioElement.pause();
      audioElement = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
  }, []);

  const sendInput = useCallback(async (input: TurnInput) => {
    if (!currentSessionId) {
      console.error('Session not initialized. Call initializeSession first.');
      return;
    }

    setStatus('thinking');

    try {
      // Use /api/chat endpoint which connects to Gemini conversation service
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: input.mode === 'tap' ? '' : input.text,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send input');
      }

      const data: ChatResponse = await response.json();

      if (data.state) {
        setState(data.state);
        setStateSnapshot(data.state);
      }

      const userText = input.mode === 'tap' ? 'Tap: ' + input.quickReply : input.text;
      setHistory((prev) => [
        ...prev,
        { role: 'user', text: userText },
        { role: 'assistant', text: data.response },
      ]);

      if (input.mode !== 'text') {
        speak(data.response, language);
      }
    } catch (err) {
      setError({
        code: 'NETWORK_TIMEOUT',
        message: err instanceof Error ? err.message : 'Unknown error',
        retryable: true,
      });
    } finally {
      setStatus('idle');
    }
  }, [language, speak, setStatus]);

  return {
    state,
    stateSnapshot,
    history,
    language,
    currentStep: state?.currentStep || 'language_selection',
    voice,
    error,
    setStatus,
    sendInput,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    initializeSession,
    getAudioContext,
  };
}

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  let binary = '';
  const bytes = [...new Uint8Array(buffer)];
  const len = bytes.length;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
