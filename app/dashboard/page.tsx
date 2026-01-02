'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Message,
  PersonaType,
  PERSONA_DEFAULTS,
  AVATAR_COLORS,
  LANGUAGE_LABELS,
} from '@/lib/types';

export default function Dashboard() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth & User State
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Setup Flow State
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [country, setCountry] = useState('');
  const [age, setAge] = useState('');
  const [consent, setConsent] = useState(false);
  const [language, setLanguage] = useState('en');
  const [showLangScreen, setShowLangScreen] = useState(false);
  const [showPersonaSetup, setShowPersonaSetup] = useState(false);

  // Persona Setup State
  const [selectedPersona, setSelectedPersona] = useState<PersonaType | null>(null);
  const [customName, setCustomName] = useState('');
  const [gender, setGender] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);

  // Chat State
  const [currentPersona, setCurrentPersona] = useState<PersonaType | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Ready');

  // Sidebar State
  const [personas, setPersonas] = useState<Map<PersonaType, any>>(new Map());
  const [showSettings, setShowSettings] = useState(false);

  // Initialize
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/');
        return;
      }

      // Get user data
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('google_id', (data.session.user.user_metadata as any).google_id)
        .single();

      if (userData) {
        setUser(userData);
        setLanguage(userData.language || 'en');

        // Initialize personas
        const personasMap = new Map();
        Object.keys(PERSONA_DEFAULTS).forEach((key) => {
          const personaType = key as PersonaType;
          personasMap.set(personaType, {
            customName: `${PERSONA_DEFAULTS[personaType].name}`,
            gender: userData.gender || 'Other',
            color: AVATAR_COLORS[Object.keys(PERSONA_DEFAULTS).indexOf(key) % AVATAR_COLORS.length],
          });
        });
        setPersonas(personasMap);

        // Load saved setup or show setup
        const saved = localStorage.getItem('aa_setup_complete');
        if (!saved) {
          setShowAgeGate(true);
        } else {
          const savedPersona = localStorage.getItem('aa_current_persona') as PersonaType;
          if (savedPersona) {
            setCurrentPersona(savedPersona);
            loadMessages(savedPersona);
          }
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleAgeVerify = () => {
    if (!country || !age || !consent) {
      alert('Please fill all fields and consent');
      return;
    }

    const requiredAge = country === 'AE' ? 21 : 18;
    if (parseInt(age) < requiredAge) {
      alert(`Must be ${requiredAge}+ to continue`);
      return;
    }

    localStorage.setItem('aa_verified', 'true');
    setShowAgeGate(false);
    setShowLangScreen(true);
  };

  const handleLanguageContinue = () => {
    localStorage.setItem('aa_language', language);
    setShowLangScreen(false);
    setShowPersonaSetup(true);
  };

  const handlePersonaSetup = () => {
    if (!selectedPersona || !customName || !gender) {
      alert('Please complete all fields');
      return;
    }

    const newPersonasMap = new Map(personas);
    newPersonasMap.set(selectedPersona, {
      customName,
      gender,
      color: selectedColor,
    });
    setPersonas(newPersonasMap);

    localStorage.setItem(`aa_persona_${selectedPersona}_name`, customName);
    localStorage.setItem(`aa_persona_${selectedPersona}_gender`, gender);
    localStorage.setItem(`aa_persona_${selectedPersona}_color`, selectedColor);
    localStorage.setItem('aa_setup_complete', 'true');
    localStorage.setItem('aa_current_persona', selectedPersona);

    setCurrentPersona(selectedPersona);
    setShowPersonaSetup(false);
    loadMessages(selectedPersona);
  };

  const loadMessages = (persona: PersonaType) => {
    const saved = localStorage.getItem(`aa_chat_${persona}`);
    if (saved) {
      setMessages(JSON.parse(saved));
    } else {
      setMessages([]);
    }
  };

  const saveMessages = (persona: PersonaType, msgs: Message[]) => {
    localStorage.setItem(`aa_chat_${persona}`, JSON.stringify(msgs));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !currentPersona) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      time: new Date().toISOString(),
      delivered: false,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setStatus('Sending...');

    try {
      // Mark as delivered
      setTimeout(() => {
        userMessage.delivered = true;
        setMessages([...newMessages]);
      }, 1000);

      // Get persona info
      const personaInfo = personas.get(currentPersona);
      const genderLabel =
        gender || personaInfo?.gender || 'Other';
      const nameLabel = personaInfo?.customName || PERSONA_DEFAULTS[currentPersona].name;

      setIsTyping(true);
      setStatus('Thinking...');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          personaType: currentPersona,
          customName: nameLabel,
          gender: genderLabel,
          language: language,
          history: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error ${response.status}`);
      }

      const data = await response.json();
      const aiMessage: Message = {
        role: 'assistant',
        content: data.response,
        time: new Date().toISOString(),
      };

      const allMessages = [...newMessages, aiMessage];
      setMessages(allMessages);
      saveMessages(currentPersona, allMessages);

      setStatus('Ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error sending message');
      setStatus('Error');
      const errorMsg: Message = {
        role: 'system',
        content: `⚠️ ${err instanceof Error ? err.message : 'Error'}`,
        time: new Date().toISOString(),
      };
      setMessages([...newMessages, errorMsg]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  // Age Gate
  if (showAgeGate) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">⚖️</div>
            <h1 className="text-2xl font-bold">Legal Verification</h1>
            <p className="text-gray-600 mt-2">AdultAlly is for 18+ only</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
            <p className="text-sm text-yellow-800">
              By proceeding, you confirm you are of legal adult age in your jurisdiction.
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold mb-2">Your Country</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Select --</option>
                <option value="IN">India (18+)</option>
                <option value="US">United States (18+)</option>
                <option value="UK">United Kingdom (18+)</option>
                <option value="AE">UAE (21+)</option>
                <option value="CA">Canada (18+)</option>
                <option value="AU">Australia (18+)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Your Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Enter age"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-600">
                I confirm I am of legal adult age and consent to 18+ content
              </span>
            </label>
          </div>

          <button
            onClick={handleAgeVerify}
            disabled={!country || !age || !consent}
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Verify & Continue
          </button>
        </div>
      </div>
    );
  }

  // Language Selection
  if (showLangScreen) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-center mb-6">Choose Your Language</h1>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded mb-6 focus:outline-none focus:border-blue-500"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="kn">ಕನ್ನಡ (Kannada)</option>
          </select>

          <button
            onClick={handleLanguageContinue}
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700"
          >
            Continue
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            Your language preference is stored on this device only.
          </p>
        </div>
      </div>
    );
  }

  // Persona Setup
  if (showPersonaSetup) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-center mb-6">Choose Your Companion</h1>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {(Object.entries(PERSONA_DEFAULTS) as Array<[PersonaType, any]>).map(
              ([key, persona]) => (
                <button
                  key={key}
                  onClick={() => setSelectedPersona(key)}
                  className={`p-4 border-2 rounded transition ${
                    selectedPersona === key
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <div className="text-3xl mb-2">{persona.emoji}</div>
                  <div className="font-semibold text-xs">{persona.name}</div>
                </button>
              )
            )}
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold mb-2">
                What would you like to call them?
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., Alex, Sarah"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Select --</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Avatar Color</label>
              <div className="flex gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-8 h-8 rounded-full border-2 transition ${
                      selectedColor === color
                        ? 'border-gray-900 scale-110'
                        : 'border-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handlePersonaSetup}
            disabled={!selectedPersona || !customName || !gender}
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Start Chat
          </button>
        </div>
      </div>
    );
  }

  // Main Chat Interface
  if (!currentPersona) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <button
          onClick={() => {
            localStorage.removeItem('aa_setup_complete');
            setShowPersonaSetup(true);
          }}
          className="bg-blue-600 text-white px-6 py-3 rounded font-semibold hover:bg-blue-700"
        >
          Select Persona
        </button>
      </div>
    );
  }

  const personaInfo = personas.get(currentPersona);
  const personaDefaults = PERSONA_DEFAULTS[currentPersona];

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="text-2xl">💬 AdultAlly</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            Status: <span className="text-green-400">{status}</span>
          </div>
          <button
            onClick={() => {
              localStorage.clear();
              router.push('/');
            }}
            className="text-xl hover:text-gray-300"
            title="Logout"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-700 text-sm font-semibold text-gray-400">
            PERSONAS
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {Array.from(personas.entries()).map(([type, info]) => (
              <button
                key={type}
                onClick={() => {
                  setCurrentPersona(type);
                  loadMessages(type);
                }}
                className={`w-full text-left p-3 rounded mb-2 transition ${
                  currentPersona === type
                    ? 'bg-blue-600'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <div className="font-semibold text-sm">{info.customName}</div>
                <div className="text-xs text-gray-300">
                  {messages.length > 0 ? `${messages.length} messages` : 'No messages'}
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-gray-700 space-y-2">
            <button
              onClick={() => {
                setMessages([]);
                if (currentPersona) {
                  saveMessages(currentPersona, []);
                }
              }}
              className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded text-sm font-semibold"
            >
              📝 Clear Chat
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                location.reload();
              }}
              className="w-full bg-red-700 hover:bg-red-600 py-2 rounded text-sm font-semibold"
            >
              🔄 Reset
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-900">
          {/* Chat Header */}
          <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
            <h2 className="text-xl font-bold">{personaInfo?.customName}</h2>
            <p className="text-sm text-gray-400">{personaDefaults.desc}</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <div className="text-5xl mb-4">👋</div>
                <div>Start chatting with {personaInfo?.customName}</div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : msg.role === 'system'
                        ? 'bg-red-900 text-red-100'
                        : 'bg-gray-700 text-gray-100'
                    }`}
                  >
                    <div className="text-sm">{msg.content}</div>
                    <div className="text-xs mt-1 opacity-70">
                      {new Date(msg.time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {msg.delivered && msg.role === 'user' ? ' ✓✓' : ''}
                    </div>
                  </div>
                </div>
              ))
            )}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-700 px-4 py-2 rounded-lg">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="bg-gray-800 border-t border-gray-700 p-4">
            {error && (
              <div className="bg-red-900 text-red-100 px-4 py-2 rounded mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type message..."
                disabled={isLoading}
                className="flex-1 bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                rows={2}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded font-semibold transition"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
