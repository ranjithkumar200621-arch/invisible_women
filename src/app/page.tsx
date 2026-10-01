'use client';

import { useState, useEffect } from 'react';
import { useConversation } from '../hooks/useConversation';

export default function Home() {
  const [language, setLanguage] = useState<string>('ta');
  const [showLanguagePicker, setShowLanguagePicker] = useState(true);
  const { state, stateSnapshot, history, currentStep, voice } = useConversation();

  useEffect(() => {
    // Load enabled languages
  }, []);

  if (showLanguagePicker) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6">
          <h1 className="text-2xl font-bold text-center mb-6 text-indigo-600">
            Welcome to the Government Schemes Assistant
          </h1>
          <p className="text-center mb-6 text-gray-600">
            Select your preferred language to begin
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setLanguage('ta');
                setShowLanguagePicker(false);
              }}
              className="w-full py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
            >
              தமிழ் (Tamil)
            </button>
            <button
              onClick={() => {
                setLanguage('hi');
                setShowLanguagePicker(false);
              }}
              className="w-full py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
            >
              हिन्दी (Hindi)
            </button>
            <button
              onClick={() => {
                setLanguage('en');
                setShowLanguagePicker(false);
              }}
              className="w-full py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
            >
              English
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <button
            onClick={() => setShowLanguagePicker(true)}
            className="text-sm text-gray-500 hover:text-indigo-600"
          >
            Change Language
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Conversation History */}
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {history.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                Your conversation history will appear here
              </div>
            )}
            {history.map((turn, i) => (
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
            ))}
            {voice.isThinking && (
              <div className="flex justify-start">
                <div className="bg-indigo-100 text-indigo-800 px-4 py-3 rounded-lg">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-gray-50 border-t">
            {currentStep !== 'language_selection' && (
              <div className="space-y-2">
                <button
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center space-x-2"
                  onClick={() => {/* Voice input */}}
                >
                  <span className="text-xl">🎤</span>
                  <span>Speak your response</span>
                </button>
                <div className="text-center">
                  <span className="text-xs text-gray-500">or type your response</span>
                </div>
                <input
                  type="text"
                  placeholder="Type your response..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
