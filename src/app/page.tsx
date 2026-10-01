'use client';

import { useState, useEffect, useRef } from 'react';
import { useConversation } from '../hooks/useConversation';

export default function Home() {
  const { state, stateSnapshot, history, currentStep, voice, language, setStatus, sendInput, startListening, stopListening, speak, stopSpeaking, initializeSession } = useConversation();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize session when component mounts
  useEffect(() => {
    initializeSession();
  }, []);

  const handleSpeechToggle = async () => {
    if (!voice.isListening && !isRecording) {
      setIsRecording(true);
      await startListening((text: string) => {
        setTranscript(text);
        setShowTranscript(true);
        sendInput({ mode: 'voice', text });
        setIsRecording(false);
        stopListening();
      });
    } else {
      stopListening();
      setIsRecording(false);
    }
  };

  const handleStopSpeaking = () => {
    stopSpeaking();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const base64 = arrayBufferToBase64(arrayBuffer);
      
      try {
        setStatus('thinking');
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
          setTranscript(data.transcript);
          sendInput({ mode: 'voice', text: data.transcript });
        } else {
          setStatus('idle');
        }
      } catch (err) {
        setStatus('idle');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = [...new Uint8Array(buffer)];
    const len = bytes.length;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    const text = input.value.trim();
    
    if (text) {
      setTranscript(text);
      sendInput({ mode: 'text', text });
      input.value = '';
    }
  };

  const playResponseAudio = async (text: string) => {
    try {
      const response = await fetch('/api/speech/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          languageCode: language,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAudioUrl(`data:${data.mimeType};base64,${data.audioBase64}`);
      }
    } catch (err) {
      // Fallback to browser TTS
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'ta' ? 'ta-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
      synth.speak(utterance);
    }
  };

  useEffect(() => {
    if (history.length > 0 && !voice.isThinking) {
      const lastTurn = history[history.length - 1];
      if (lastTurn.role === 'assistant' && !audioUrl) {
        playResponseAudio(lastTurn.text);
      }
    }
  }, [history, voice.isThinking, audioUrl]);

  useEffect(() => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(err => console.error('Audio play error:', err));
    }
  }, [audioUrl]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">👩‍💼</span>
            <h1 className="text-xl font-semibold text-gray-800">
              {language === 'ta' ? 'அரசு திட்டங்கள்'
                : language === 'hi' ? 'सरकारी योजनाएँ'
                : 'Government Schemes'}
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Conversation History */}
          <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
            {history.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>Loading conversation...</p>
              </div>
            ) : (
              history.map((turn, i) => (
                <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      turn.role === 'user'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {turn.text}
                  </div>
                </div>
              ))
            )}
            {voice.isThinking && (
              <div className="flex justify-start">
                <div className="bg-indigo-100 text-indigo-800 px-4 py-3 rounded-lg">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Transcript Display */}
          {showTranscript && transcript && (
            <div className="px-4 py-2 bg-blue-50 border-b">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">You said: </span>
                {transcript}
              </p>
            </div>
          )}

          {/* Audio Player */}
          {audioUrl && (
            <div className="px-4 py-2">
              <audio controls src={audioUrl} className="w-full" />
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 bg-gray-50 border-t">
            <div className="space-y-2">
              {/* Voice Recording Button */}
              <div className="flex space-x-2">
                <button
                  className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                    voice.isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                  onClick={handleSpeechToggle}
                >
                  <span className="text-xl">{voice.isListening ? '⏹️' : '🎤'}</span>
                  <span>{voice.isListening ? 'Stop Recording' : 'Speak'}</span>
                </button>
                
                {/* File Upload Button */}
                <label className="flex items-center justify-center px-4 py-3 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg cursor-pointer transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <span className="text-xl">📁</span>
                </label>
              </div>
              
              {/* Text Input Form */}
              <form onSubmit={handleTextSubmit} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                  >
                    Send
                  </button>
                </div>
                <div className="text-center">
                  <span className="text-xs text-gray-500">Speak or type your message</span>
                </div>
              </form>

              {/* Stop Speaking Button */}
              {voice.isSpeaking && (
                <button
                  onClick={handleStopSpeaking}
                  className="w-full py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg text-sm"
                >
                  Stop Speaking
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
