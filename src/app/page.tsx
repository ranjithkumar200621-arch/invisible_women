'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useConversation } from '../hooks/useConversation';

export default function Home() {
  const { state, history, currentStep, voice, language, setStatus, sendInput, startListening, stopListening, speak, stopSpeaking, initializeSession } = useConversation();
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [history, scrollToBottom]);

  // Initialize session
  useEffect(() => {
    initializeSession();
  }, []);

  // Reset UI state on new session
  useEffect(() => {
    setShowDocuments(false);
    setShowSteps(false);
    setAudioUrl(null);
    setShowTranscript(false);
  }, [currentStep]);

  // Handle voice recording toggle
  const handleSpeechToggle = async () => {
    if (!voice.isListening && !voice.isThinking) {
      setStatus('listening');
      await startListening((text: string) => {
        setTranscript(text);
        setShowTranscript(true);
        sendInput({ mode: 'voice', text });
        setStatus('idle');
        stopListening();
      });
    } else {
      stopListening();
      setStatus('idle');
    }
  };

  // Handle text submit
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    const text = input.value.trim();
    
    if (text && !voice.isThinking) {
      setTranscript(text);
      sendInput({ mode: 'text', text });
      input.value = '';
    }
  };

  // Handle file upload for audio
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || voice.isThinking) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const binary = Array.from(new Uint8Array(arrayBuffer)).map(b => String.fromCharCode(b)).join('');
      const base64 = btoa(binary);
      
      setStatus('thinking');
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
          setTranscript(data.transcript);
          sendInput({ mode: 'voice', text: data.transcript });
        }
      } catch (err) {
        console.error('ASR error:', err);
      } finally {
        setStatus('idle');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Play TTS response
  const playTTS = async (text: string) => {
    if (!text || voice.isThinking) return;
    
    setStatus('speaking');
    try {
      await speak(text, language);
    } finally {
      setStatus('idle');
    }
  };

  // Stop current speech
  const handleStopSpeaking = () => {
    stopSpeaking();
    setStatus('idle');
  };

  // Check if response should be spoken
  const shouldAutoSpeak = (message: string) => {
    // Don't auto-speak very short messages
    return message.length > 10;
  };

  // Render message content based on current step
  const renderMessageContent = (text: string) => {
    switch (currentStep) {
      case 'documents':
        return (
          <div className="documents">
            <h3>📄 Required Documents</h3>
            <ul>
              <li>Aadhaar card - Proof of identity and address</li>
              <li>Birth certificate or SSLC mark sheet - Proof of age</li>
              <li>Ration card or voter ID - Tamil Nadu residence proof</li>
              <li>Bank passbook - For direct benefit transfer</li>
            </ul>
          </div>
        );
      case 'application_guidance':
        return (
          <div className="steps">
            <h3>📋 How to Apply</h3>
            <ol>
              <li>Visit your nearest Social welfare or Women & Child Development office</li>
              <li>Obtain the application form from the office</li>
              <li>Fill in your details and attach required documents</li>
              <li>Submit the application and keep the receipt</li>
              <li>Amount will be credited to your bank account after approval</li>
            </ol>
            <div className="action-card" style={{ marginTop: '12px' }}>
              <h4 style={{ margin: 0 }}>Official Application</h4>
              <button onClick={() => window.open('https://dbttn.gov.in/', '_blank')}>
                Open Application Portal
              </button>
            </div>
          </div>
        );
      default:
        return text;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="app-header">
        <div className="icon-bot">👩</div>
        <h1>கலைஞர் மகளிர் உரிமைத்தொகை</h1>
        <p>Kalaignar Magalir Urimai Thogai</p>
      </header>

      {/* Status Bar */}
      {(voice.isListening || voice.isSpeaking || voice.isThinking) && (
        <div className={`status-bar ${voice.isListening ? 'recording' : voice.isThinking ? 'thinking' : ''}`}>
          {voice.isListening && '🎤 Listening...'}
          {voice.isThinking && '🤔 Processing...'}
          {voice.isSpeaking && '🔊 Speaking...'}
        </div>
      )}

      {/* Main Content */}
      <main className="main-content flex-1">
        {/* Conversation History */}
        <div className="conversation-container">
          <div className="message-list">
            {history.length === 0 ? (
              <div className="empty-state">
                <div className="icon">👩</div>
                <h2>Welcome to The Invisible Woman</h2>
                <p>I can help you find information about government women's welfare schemes.</p>
                <p style={{ marginTop: '16px', fontSize: '0.9rem', color: '#666' }}>
                 Tap to listen, or speak your question
                </p>
              </div>
            ) : (
              history.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === 'user' ? '👤' : '👩'}
                  </div>
                  <div className="message-content">
                    {typeof msg.text === 'string' ? msg.text : null}
                    {msg.role === 'assistant' && currentStep === 'documents' && (
                      <div className="documents">
                        <h3>Required Documents</h3>
                        <ul>
                          <li>Aadhaar card - Proof of identity and address</li>
                          <li>Birth certificate or SSLC mark sheet - Proof of age</li>
                          <li>Ration card or voter ID - Tamil Nadu residence proof</li>
                          <li>Bank passbook - For direct benefit transfer</li>
                        </ul>
                      </div>
                    )}
                    {msg.role === 'assistant' && currentStep === 'application_guidance' && (
                      <div className="steps">
                        <h3>How to Apply</h3>
                        <ol>
                          <li>Visit your nearest Social welfare office</li>
                          <li>Obtain and fill the application form</li>
                          <li>Submit with required documents</li>
                          <li>Amount credited after approval</li>
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {voice.isThinking && (
              <div className="message assistant">
                <div className="message-avatar">👩</div>
                <div className="message-content">
                  <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Thinking...</p>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Eligibility Result Card */}
        {currentStep === 'eligible' && state && (
          <div className="container">
            <div className="message.assistant .message-content .result-eligible" style={{ 
              background: '#d4edda', 
              border: '2px solid #c3e6cb',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              margin: '16px 0',
            }}>
              <h2 style={{ color: '#155724', margin: '0 0 12px' }}>🎉 Congratulations!</h2>
              <p style={{ color: '#155724', fontSize: '1.1rem' }}>
                You are eligible for the Kalaignar Magalir Urimai Thogai scheme!
              </p>
              <p style={{ margin: '16px 0', color: '#155724' }}>
                Monthly benefit: ₹1,000 (₹12,000 per year)
              </p>
              <button 
                onClick={() => setShowDocuments(true)}
                style={{ 
                  background: '#155724', 
                  color: 'white', 
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                View Required Documents
              </button>
            </div>
          </div>
        )}

        {currentStep === 'not_eligible' && state && (
          <div className="container">
            <div className="message.assistant .message-content .result-not-eligible" style={{ 
              background: '#f8d7da', 
              border: '2px solid #f5c6cb',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              margin: '16px 0',
            }}>
              <h2 style={{ color: '#721c24', margin: '0 0 12px' }}>Sorry</h2>
              <p style={{ color: '#721c24', fontSize: '1.1rem' }}>
                You are not eligible for this scheme at this time.
              </p>
              <p style={{ margin: '16px 0', color: '#721c24' }}>
                We recommend checking other government schemes you may qualify for.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="input-container">
        {/* Documents Modal */}
        {showDocuments && (
          <div className="documents" style={{ 
            marginBottom: '16px',
            padding: '16px',
            background: '#fff3cd',
            border: '1px solid #ffeeba',
            borderRadius: '8px'
          }}>
            <h4 style={{ margin: '0 0 12px' }}>Required Documents:</h4>
            <ul style={{ margin: 0, padding: '0 20px' }}>
              <li>Aadhaar card - Proof of identity and address</li>
              <li>Birth certificate or SSLC mark sheet - Proof of age</li>
              <li>Ration card or voter ID - Tamil Nadu residence proof</li>
              <li>Bank passbook - For direct benefit transfer</li>
            </ul>
            <button 
              onClick={() => setShowDocuments(false)}
              style={{
                marginTop: '12px',
                background: '#856404',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        )}

        {/* Application Steps Modal */}
        {showSteps && (
          <div className="steps" style={{ 
            marginBottom: '16px',
            padding: '16px',
            background: '#cce5ff',
            border: '1px solid #99caff',
            borderRadius: '8px'
          }}>
            <h4 style={{ margin: '0 0 12px' }}>How to Apply:</h4>
            <ol style={{ margin: 0, padding: '0 20px' }}>
              <li>Visit your nearest Social welfare or Women & Child Development office</li>
              <li>Obtain the application form from the office</li>
              <li>Fill in details and attach required documents</li>
              <li>Submit the application and keep the receipt</li>
              <li>Amount will be credited to your bank account after approval</li>
            </ol>
            <button 
              onClick={() => setShowSteps(false)}
              style={{
                marginTop: '12px',
                background: '#004085',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="input-actions">
          <button
            className={voice.isListening ? 'listening' : 'primary'}
            onClick={handleSpeechToggle}
            disabled={voice.isThinking}
            aria-label={voice.isListening ? 'Stop recording' : 'Start voice recording'}
          >
            {voice.isListening ? '⏹️ Stop' : '🎤 Speak'}
          </button>
          
          <label className="secondary" style={{ cursor: 'pointer' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={voice.isThinking}
            />
            📁 Upload
          </label>

          <button
            className={voice.isThinking ? 'disabled' : 'secondary'}
            onClick={() => {
              if (history.length > 0) {
                const lastResponse = history[history.length - 1]?.text;
                if (lastResponse) playTTS(lastResponse);
              }
            }}
            disabled={voice.isThinking || history.length === 0}
          >
            🔄 Repeat
          </button>
        </div>

        {/* Text Input Form */}
        <form onSubmit={handleTextSubmit} className="text-input-container">
          <input
            type="text"
            placeholder="Type your message..."
            disabled={voice.isThinking}
            aria-label="Type your message"
            autoComplete="off"
          />
          <button 
            type="submit"
            disabled={voice.isThinking}
          >
            Send
          </button>
        </form>

        <p className="hint-text">
          Speak or type in {language === 'ta' ? 'Tamil' : 'English'}
        </p>
      </footer>

      {/* Footer */}
      <footer className="app-footer">
        <p>A government of Tamil Nadu initiative</p>
        <p style={{ marginTop: '8px' }}>
          For assistance: <a href="tel:181">181</a> | 
          <a href="tel:044-28544000" style={{ marginLeft: '8px' }}>044-28544000</a>
        </p>
      </footer>
    </div>
  );
}
