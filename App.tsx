
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message, PlaceData, Location, ChatSession, User } from './types';
import { sendMessageToGemini, startNewChat, resumeChat } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import Sidebar from './components/Sidebar';

// Fix: Extend Window interface to include google property for Google Sign-In
declare global {
  interface Window {
    google: any;
  }
}

// Decodes JWT token structure from Google Sign-In
function parseJwt (token: string) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

// Fallback Bear Icon for when external images fail
const FallbackBearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full p-1.5 text-slate-400 dark:text-slate-500" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 10v4a5 5 0 0 1 10 0v-4" />
    <path d="M2 12a10 10 0 1 1 20 0 10 10 0 0 1-20 0z" />
    <circle cx="9" cy="11" r="1" />
    <circle cx="15" cy="11" r="1" />
    <path d="M12 13v1" />
  </svg>
);

function App() {
  // --- State ---
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  // Using a fixed seed for a consistent guest avatar
  const GUEST_AVATAR_SEED = 'condoscout-v1-guest'; 
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<Location | undefined>(undefined);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [imageError, setImageError] = useState(false);
  
  // UI State for Dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle Google Login
  const handleCredentialResponse = (response: any) => {
    try {
      const payload = parseJwt(response.credential);
      const newUser: User = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        picture: payload.picture
      };
      setUser(newUser);
      setIsGuest(false);
      localStorage.setItem('condoscout_user', JSON.stringify(newUser));
    } catch (e) {
      console.error("Login failed", e);
    }
  };

  // Handle Guest Login
  const handleGuestLogin = () => {
    setIsGuest(true);
    setUser(null);
  };

  // Render Google Button
  useEffect(() => {
    if (!user && !isGuest && window.google && googleButtonRef.current) {
       window.google.accounts.id.initialize({
        client_id: "727392686189-u3558g67u60et872hll962g557j03s72.apps.googleusercontent.com",
        callback: handleCredentialResponse,
        auto_select: false,
        theme: isDarkMode ? "filled_black" : "outline"
      });
      window.google.accounts.id.renderButton(
        googleButtonRef.current,
        { theme: isDarkMode ? "filled_black" : "outline", size: "large", width: 280, shape: "pill" }
      );
    }
  }, [user, isGuest, isDarkMode]);

  // Initial load
  useEffect(() => {
    const savedUser = localStorage.getItem('condoscout_user');
    const savedTheme = localStorage.getItem('condoscout_theme');
    
    if (savedTheme === 'dark') setIsDarkMode(true);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setIsGuest(false);
      } catch(e) {
        console.error(e);
      }
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
            (error) => console.log("Location access error:", error)
        );
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Session Storage parsing
  const parseAndLoadSessions = (jsonString: string | null) => {
    if (jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        setSessions(parsed);
        if (parsed.length > 0) {
          const mostRecent = parsed.sort((a: ChatSession, b: ChatSession) => b.lastUpdated - a.lastUpdated)[0];
          setCurrentSessionId(mostRecent.id);
          resumeChat(mostRecent.messages);
        } else {
          createNewSession();
        }
      } catch (e) {
        createNewSession();
      }
    } else {
      createNewSession();
    }
  };

  useEffect(() => {
    if (user) {
      const storageKey = `condoscout_sessions_${user.id}`;
      parseAndLoadSessions(localStorage.getItem(storageKey));
    } else if (isGuest) {
      parseAndLoadSessions(sessionStorage.getItem('condoscout_guest_sessions'));
    }
  }, [user, isGuest]);

  useEffect(() => {
    if (sessions.length >= 0) {
      if (user) localStorage.setItem(`condoscout_sessions_${user.id}`, JSON.stringify(sessions));
      else if (isGuest) sessionStorage.setItem('condoscout_guest_sessions', JSON.stringify(sessions));
    }
  }, [sessions, user, isGuest]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('condoscout_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, isLoading]);

  const getCurrentMessages = () => sessions.find(s => s.id === currentSessionId)?.messages || [];

  const createNewSession = () => {
    const newId = uuidv4();
    const welcomeMsg: Message = {
      id: 'welcome',
      role: 'model',
      text: "👋 Hello, I'm **Royce**.\n\nI am your personal real estate concierge. I'll help you find condominiums, apartments, or luxury hotels.\n\n*\"Show me some 1-bedroom apartments in Sukhumvit near the station.\"*",
      places: []
    };
    
    const newSession: ChatSession = {
      id: newId,
      title: 'New Search',
      messages: [welcomeMsg],
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    startNewChat();
    if (isMobile) setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) {
      if (newSessions.length > 0) {
        setCurrentSessionId(newSessions[0].id);
        resumeChat(newSessions[0].messages);
      } else {
        createNewSession();
      }
    }
  };

  const handleLogout = () => {
    setUser(null);
    setIsGuest(false);
    setSessions([]);
    setCurrentSessionId(null);
    localStorage.removeItem('condoscout_user');
    setIsDropdownOpen(false);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !currentSessionId) return;
    const userText = inputText.trim();
    setInputText('');
    const userMsg: Message = { id: uuidv4(), role: 'user', text: userText };
    const thinkingMsgId = uuidv4();
    const thinkingMsg: Message = { id: thinkingMsgId, role: 'model', text: '', isThinking: true };

    setSessions(prev => prev.map(session => {
      if (session.id === currentSessionId) {
        return {
          ...session,
          title: session.messages.length <= 1 ? (userText.length > 30 ? userText.substring(0, 30) + '...' : userText) : session.title,
          lastUpdated: Date.now(),
          messages: [...session.messages, userMsg, thinkingMsg]
        };
      }
      return session;
    }));

    setIsLoading(true);
    try {
      const response = await sendMessageToGemini(userText, location);
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          const updatedMessages = session.messages.map(msg => msg.id === thinkingMsgId ? { ...msg, text: response.text, places: response.places, isThinking: false } : msg);
          return { ...session, messages: updatedMessages };
        }
        return session;
      }));
    } catch (error) {
       setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          const updatedMessages = session.messages.map(msg => msg.id === thinkingMsgId ? { ...msg, text: "Connection error. Please try again.", isThinking: false } : msg);
          return { ...session, messages: updatedMessages };
        }
        return session;
      }));
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const messages = getCurrentMessages();
  // Simplified stable URL for DiceBear with fixed seed
  const guestAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${GUEST_AVATAR_SEED}&radius=50`;

  const themeToggleIcon = isDarkMode ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
  );

  if (!user && !isGuest) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 relative overflow-hidden">
         {/* Theme Toggle Button in Top Right */}
         <button 
           onClick={() => setIsDarkMode(!isDarkMode)} 
           className="absolute top-6 right-6 p-3 rounded-full bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white shadow-lg border border-slate-200 dark:border-slate-700 transition-all hover:scale-110 active:scale-95 z-50"
           title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
         >
           {themeToggleIcon}
         </button>

         <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none"></div>
         <div className="relative z-10 flex flex-col items-center max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
             <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-2">
                 <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
             </div>
             <div>
               <h1 className="text-4xl font-bold tracking-tight mb-3">CondoScout</h1>
               <p className="text-slate-500 dark:text-slate-400 text-lg">Your Personal Real Estate Concierge</p>
             </div>
             <div className="w-full bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
                 <div className="flex flex-col space-y-4 items-center">
                    <div className="flex justify-center h-[50px]"><div ref={googleButtonRef}></div></div>
                    <div className="relative w-full flex items-center py-2"><div className="grow border-t border-slate-200 dark:border-slate-700"></div><span className="shrink-0 mx-4 text-xs text-slate-400 uppercase font-semibold">Or</span><div className="grow border-t border-slate-200 dark:border-slate-700"></div></div>
                    <button 
                        onClick={handleGuestLogin}
                        className="w-full max-w-[280px] py-2.5 px-4 bg-transparent border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full font-medium transition-all text-sm flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 shadow-sm"
                    >
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                            <img 
                              src={guestAvatarUrl} 
                              alt="Guest Bear" 
                              className="w-full h-full object-cover" 
                              onError={(e) => { e.currentTarget.style.display = 'none'; setImageError(true); }}
                            />
                            {imageError && <FallbackBearIcon />}
                        </div>
                        Continue as Guest
                    </button>
                 </div>
             </div>
         </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} isMobile={isMobile} sessions={sessions} currentSessionId={currentSessionId} 
        onSelectSession={(id) => { const s = sessions.find(x => x.id === id); if(s) { setCurrentSessionId(id); resumeChat(s.messages); } if(isMobile) setIsSidebarOpen(false); }} 
        onNewChat={createNewSession} onDeleteSession={deleteSession} onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 relative h-full">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-3 md:py-4 px-4 shadow-sm z-10 shrink-0 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200/50 dark:shadow-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                </div>
                <h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white tracking-tight leading-tight">CondoScout</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title={isDarkMode ? "Light" : "Dark"}>
                {isDarkMode ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>}
              </button>
              <div className="relative" ref={dropdownRef}>
                  <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center space-x-2 border-l border-slate-200 dark:border-slate-800 pl-3 md:pl-4 focus:outline-none">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden border border-slate-300 dark:border-slate-600 shadow-sm flex items-center justify-center">
                        <img 
                            src={user ? user.picture : guestAvatarUrl} 
                            alt="Profile" 
                            className="w-full h-full object-cover" 
                            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('flex'); }}
                        />
                        <div className="hidden"><FallbackBearIcon /></div>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                  {isDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 mb-1">
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{user ? user.name : "Guest User"}</p>
                          </div>
                          <div className="px-1">
                              <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-2 transition-colors">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                  Sign Out
                              </button>
                          </div>
                      </div>
                  )}
              </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          <div className="max-w-5xl mx-auto space-y-6">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} userAvatar={user ? user.picture : guestAvatarUrl} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 md:p-4 shrink-0 z-20 pb-safe">
          <div className="max-w-5xl mx-auto relative">
            <div className="relative flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl border border-transparent focus-within:border-indigo-500/30 dark:focus-within:border-indigo-500/50 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:shadow-md transition-all duration-200">
              <input
                ref={inputRef} type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} disabled={isLoading} autoComplete="off"
                className="w-full bg-transparent border-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-0 px-4 md:px-5 py-3 md:py-4 min-h-[50px] md:min-h-[56px] text-base pr-12 md:pr-14"
                placeholder="e.g., 'Luxury condo in Silom under 40k...'"
              />
              <button onClick={handleSendMessage} disabled={!inputText.trim() || isLoading} className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${!inputText.trim() || isLoading ? 'bg-slate-200 dark:bg-slate-700 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm active:scale-95'}`}>
                {isLoading ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>}
              </button>
            </div>
            <p className="text-center text-[10px] md:text-xs text-slate-400 dark:text-slate-500 mt-2">CondoScout AI. Professional real estate curator.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
