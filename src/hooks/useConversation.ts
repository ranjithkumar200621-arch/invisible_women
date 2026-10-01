'use client';

import { useState, useCallback } from 'react';
import type { ConversationState } from '../types/conversation';
import type { TurnInput, TurnRequest, TurnResponse } from '../types/api';
import type { ApiError } from '../types/api';

interface UseConversationReturn {
  state: ConversationState | null;
  stateSnapshot: ConversationState | null;
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
  currentStep: string;
  voice: {
    isListening: boolean;
    isSpeaking: boolean;
    isThinking: boolean;
    mode: 'bhashini' | 'browser' | 'text';
  };
  error: ApiError | null;
  setStatus: (status: 'listening' | 'speaking' | 'thinking' | 'idle') => void;
  sendInput: (input: TurnInput) => Promise<void>;
}

export function useConversation(): UseConversationReturn {
  const [state, setState] = useState<ConversationState | null>(null);
  const [stateSnapshot, setStateSnapshot] = useState<ConversationState | null>(null);
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [voice, setVoice] = useState({
    isListening: false,
    isSpeaking: false,
    isThinking: false,
    mode: 'text' as const,
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

  const sendInput = useCallback(async (input: TurnInput) => {
    if (!stateSnapshot) return;

    setStatus('thinking');

    try {
      const request: TurnRequest = {
        sessionId: stateSnapshot.sessionId,
        input,
        stateSnapshot,
      };

      const response = await fetch('/api/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error('Failed to send input');
      }

      const data: TurnResponse = await response.json();
      
      setState(data.state);
      setStateSnapshot(data.state);
      
      // Add to history
      const userText = input.mode === 'tap' ? 'Tap: ' + input.quickReply : input.text;
      setHistory((prev) => [
        ...prev,
        { role: 'user', text: userText },
        { role: 'assistant', text: data.reply.text },
      ]);
    } catch (err) {
      setError({
        code: 'NETWORK_TIMEOUT',
        message: err instanceof Error ? err.message : 'Unknown error',
        retryable: true,
      });
    } finally {
      setStatus('idle');
    }
  }, [stateSnapshot, setStatus]);

  return {
    state,
    stateSnapshot,
    history,
    currentStep: state?.currentStep || 'language_selection',
    voice,
    error,
    setStatus,
    sendInput,
  };
}
