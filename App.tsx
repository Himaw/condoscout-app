import React, { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Message, PlaceData, Location, ChatSession, User } from "./types";
import {
  sendMessageToGemini,
  startNewChat,
  resumeChat,
} from "./services/geminiService";
import ChatMessage from "./components/ChatMessage";
import Sidebar from "./components/Sidebar";

// Fix: Extend Window interface to include google property for Google Sign-In
declare global {
  interface Window {
    google: any;
  }
}

// Decodes JWT token structure from Google Sign-In
function parseJwt(token: string) {
  var base64Url = token.split(".")[1];
  var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  var jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(""),
  );

  return JSON.parse(jsonPayload);
}

// Fallback Bear Icon for when external images fail
const FallbackBearIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className="w-full h-full p-1.5 text-slate-400 dark:text-slate-500"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
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
  const GUEST_AVATAR_SEED = "condoscout-v1-guest";
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<Location | undefined>(undefined);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [imageError, setImageError] = useState(false);

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
        picture: payload.picture,
      };
      setUser(newUser);
      setIsGuest(false);
      localStorage.setItem("condoscout_user", JSON.stringify(newUser));
    } catch (e) {
      console.error("Login failed", e);
    }
  };

  const handleGuestLogin = () => {
    setIsGuest(true);
    setUser(null);
  };

  useEffect(() => {
    if (!user && !isGuest && window.google && googleButtonRef.current) {
      window.google.accounts.id.initialize({
        client_id:
          "727392686189-u3558g67u60et872hll962g557j03s72.apps.googleusercontent.com",
        callback: handleCredentialResponse,
        auto_select: false,
        theme: isDarkMode ? "filled_black" : "outline",
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: isDarkMode ? "filled_black" : "outline",
        size: "large",
        width: 280,
        shape: "pill",
      });
    }
  }, [user, isGuest, isDarkMode]);

  useEffect(() => {
    const savedUser = localStorage.getItem("condoscout_user");
    const savedTheme = localStorage.getItem("condoscout_theme");

    if (savedTheme === "dark") setIsDarkMode(true);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setIsGuest(false);
      } catch (e) {
        console.error(e);
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        (error) => console.log("Location access error:", error),
      );
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const parseAndLoadSessions = (jsonString: string | null) => {
    if (jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        setSessions(parsed);
        if (parsed.length > 0) {
          const mostRecent = parsed.sort(
            (a: ChatSession, b: ChatSession) => b.lastUpdated - a.lastUpdated,
          )[0];
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
      parseAndLoadSessions(sessionStorage.getItem("condoscout_guest_sessions"));
    }
  }, [user, isGuest]);

  useEffect(() => {
    if (sessions.length >= 0) {
      if (user)
        localStorage.setItem(
          `condoscout_sessions_${user.id}`,
          JSON.stringify(sessions),
        );
      else if (isGuest)
        sessionStorage.setItem(
          "condoscout_guest_sessions",
          JSON.stringify(sessions),
        );
    }
  }, [sessions, user, isGuest]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("condoscout_theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, currentSessionId, isLoading]);

  const getCurrentMessages = () =>
    sessions.find((s) => s.id === currentSessionId)?.messages || [];

  const createNewSession = () => {
    const newId = uuidv4();
    const welcomeMsg: Message = {
      id: "welcome",
      role: "model",
      text: "👋 Hello, I'm **Royce**.\n\nI am your personal real estate concierge. I'll help you find condominiums, apartments, or luxury hotels.\n\n*\"Show me some 1-bedroom apartments in Sukhumvit near the station.\"*",
      places: [],
    };

    const newSession: ChatSession = {
      id: newId,
      title: "New Search",
      messages: [welcomeMsg],
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };

    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newId);
    startNewChat();
    if (isMobile) setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter((s) => s.id !== id);
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
    localStorage.removeItem("condoscout_user");
    setIsDropdownOpen(false);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !currentSessionId) return;
    const userText = inputText.trim();
    setInputText("");
    const userMsg: Message = { id: uuidv4(), role: "user", text: userText };
    const thinkingMsgId = uuidv4();
    const thinkingMsg: Message = {
      id: thinkingMsgId,
      role: "model",
      text: "",
      isThinking: true,
    };

    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            title:
              session.messages.length <= 1
                ? userText.length > 30
                  ? userText.substring(0, 30) + "..."
                  : userText
                : session.title,
            lastUpdated: Date.now(),
            messages: [...session.messages, userMsg, thinkingMsg],
          };
        }
        return session;
      }),
    );

    setIsLoading(true);
    try {
      const response = await sendMessageToGemini(userText, location);
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === currentSessionId) {
            const updatedMessages = session.messages.map((msg) =>
              msg.id === thinkingMsgId
                ? {
                    ...msg,
                    text: response.text,
                    places: response.places,
                    isThinking: false,
                  }
                : msg,
            );
            return { ...session, messages: updatedMessages };
          }
          return session;
        }),
      );
    } catch (error) {
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === currentSessionId) {
            const updatedMessages = session.messages.map((msg) =>
              msg.id === thinkingMsgId
                ? {
                    ...msg,
                    text: "Connection error. Please try again.",
                    isThinking: false,
                  }
                : msg,
            );
            return { ...session, messages: updatedMessages };
          }
          return session;
        }),
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const messages = getCurrentMessages();
  const guestAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${GUEST_AVATAR_SEED}&radius=50`;

  const themeToggleIcon = isDarkMode ? (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  ) : (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  );

  if (!user && !isGuest) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 relative overflow-hidden transition-colors duration-500 select-none">
        {/* Colorful Aurora Background */}
        <div className="absolute top-[-20%] left-[-10%] w-[100%] h-[80%] bg-indigo-600/15 dark:bg-indigo-600/25 blur-[160px] rounded-full pointer-events-none transition-opacity duration-1000"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[90%] h-[70%] bg-violet-500/15 dark:bg-violet-500/20 blur-[140px] rounded-full pointer-events-none transition-opacity duration-1000"></div>
        <div className="absolute top-[40%] right-[-5%] w-[40%] h-[40%] bg-sky-400/15 dark:bg-sky-400/20 blur-[100px] rounded-full pointer-events-none"></div>

        {/* Theme Toggle Button */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="absolute top-6 right-6 p-3 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-xl border border-slate-200/50 dark:border-slate-700/50 transition-all hover:scale-110 active:scale-95 z-50"
        >
          {themeToggleIcon}
        </button>

        {/* Centered Logo & Branding */}
        <div className="relative z-10 flex flex-col items-center w-full max-w-5xl h-full justify-center gap-6 md:gap-10 animate-in fade-in zoom-in-95 duration-700">
          {/* Header Content - Compacted for mobile/tablet */}
          <div className="flex flex-col items-center text-center space-y-3 md:space-y-4 shrink-0">
            <div className="w-14 h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 rounded-[20px] md:rounded-[22px] flex items-center justify-center shadow-2xl shadow-indigo-500/40 transition-transform hover:scale-105 duration-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 md:w-8 md:h-8 lg:w-10 lg:h-10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
            <div className="space-y-1 md:space-y-2 px-4">
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tightest bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 dark:from-white dark:via-indigo-300 dark:to-sky-400 leading-tight">
                CondoScout
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-sm lg:text-base font-black uppercase tracking-[0.25em] md:tracking-[0.4em] opacity-90 leading-none">
                Elite Real Estate Concierge
              </p>
            </div>
          </div>

          {/* Main Glassmorphism Action Card - Responsive scaling */}
          <div className="w-full max-w-sm sm:max-w-md lg:max-w-4xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-3xl p-6 md:p-8 lg:p-12 rounded-[32px] md:rounded-[40px] border border-white/20 dark:border-slate-700/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col lg:flex-row gap-6 md:gap-8 lg:gap-12 transition-all mx-auto">
            {/* Benefits Section - Hidden on small mobile heights to save space */}
            <div className="hidden lg:flex flex-col justify-center space-y-6 border-r border-slate-200/30 dark:border-slate-700/30 pr-10 w-1/2">
              <div className="space-y-6 text-left">
                <div className="flex items-center gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base">
                      Elite Scouting
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Verified architectural data and location insights.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base">
                      3D Perspectives
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Satellite-first approach to neighborhood discovery.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Auth Actions Section */}
            <div className="flex flex-col justify-center items-center lg:w-1/2 space-y-5 md:space-y-6">
              <div className="text-center space-y-1.5">
                <h2 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                  Begin Exploration
                </h2>
                <p className="text-[11px] md:text-sm text-slate-500 dark:text-slate-400 font-medium px-4">
                  Instant access to premium curated listings.
                </p>
              </div>

              <div className="w-full flex flex-col space-y-3.5 md:space-y-4 max-w-[280px] md:max-w-xs">
                <div className="flex justify-center transition-all hover:scale-[1.03] active:scale-[0.98]">
                  <div
                    ref={googleButtonRef}
                    className="shadow-2xl rounded-full overflow-hidden border border-white/20"
                  ></div>
                </div>

                <div className="relative flex items-center py-1">
                  <div className="grow border-t border-slate-200 dark:border-slate-700/50"></div>
                  <span className="shrink-0 mx-4 text-[9px] text-slate-400 dark:text-slate-500 font-black tracking-[0.4em]">
                    OR
                  </span>
                  <div className="grow border-t border-slate-200 dark:border-slate-700/50"></div>
                </div>

                <button
                  onClick={handleGuestLogin}
                  className="w-full py-3.5 px-6 bg-white dark:bg-slate-900/80 border-2 border-slate-100 dark:border-slate-800 hover:border-indigo-600/40 dark:hover:border-indigo-400/40 text-slate-700 dark:text-slate-200 rounded-2xl font-black transition-all text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 hover:shadow-xl active:scale-95 group"
                >
                  <div className="w-5 h-5 md:w-6 md:h-6 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:scale-110 transition-transform">
                    <img
                      src={guestAvatarUrl}
                      alt="G"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  Guest Access
                </button>
              </div>
            </div>
          </div>

          {/* Sticky Footer - Compacted */}
          <div className="text-slate-400 dark:text-slate-600 text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] md:tracking-[0.6em] opacity-60 text-center shrink-0">
            Concierge Engine &middot; CondoScout AI
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      <Sidebar
        isOpen={isSidebarOpen}
        isMobile={isMobile}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={(id) => {
          const s = sessions.find((x) => x.id === id);
          if (s) {
            setCurrentSessionId(id);
            resumeChat(s.messages);
          }
          if (isMobile) setIsSidebarOpen(false);
        }}
        onNewChat={createNewSession}
        onDeleteSession={deleteSession}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 relative h-full">
        <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-b border-slate-200/60 dark:border-slate-800/60 py-3 md:py-4 px-4 md:px-6 shadow-sm z-30 shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-3 md:space-x-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:scale-105 active:scale-95"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 md:w-9 md:h-9 bg-indigo-600 rounded-[10px] flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <h1 className="text-lg md:text-xl font-black text-slate-800 dark:text-white tracking-tighter">
                CondoScout
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-5">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:rotate-12"
            >
              {isDarkMode ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 border-l border-slate-200 dark:border-slate-800 pl-3 md:pl-5 focus:outline-none group"
              >
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-sm transition-transform group-hover:scale-105">
                  <img
                    src={user ? user.picture : guestAvatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className={`text-slate-400 transition-transform duration-300 ${isDropdownOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-slate-200/50 dark:border-slate-700/50 py-3 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-700 mb-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {user ? user.name : "Guest Access"}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest mt-0.5">
                      {user ? user.email : "Limited Search History"}
                    </p>
                  </div>
                  <div className="px-2">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl flex items-center gap-3 transition-colors"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 scroll-smooth">
          <div className="max-w-4xl lg:max-w-5xl mx-auto space-y-8">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                userAvatar={user ? user.picture : guestAvatarUrl}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-slate-200/60 dark:border-slate-800/60 p-4 md:p-6 shrink-0 z-20 pb-safe">
          <div className="max-w-4xl lg:max-w-5xl mx-auto relative">
            <div className="relative flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-3xl border-2 border-transparent focus-within:border-indigo-500/20 dark:focus-within:border-indigo-500/40 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  (e.preventDefault(), handleSendMessage())
                }
                disabled={isLoading}
                autoComplete="off"
                className="w-full bg-transparent border-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-0 px-5 md:px-7 py-4 md:py-5 min-h-[56px] md:min-h-[64px] text-base md:text-lg pr-14 md:pr-16"
                placeholder="e.g., 'Luxury condo in Silom under 40k...'"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isLoading}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-2xl transition-all ${!inputText.trim() || isLoading ? "bg-slate-200 dark:bg-slate-700 text-slate-400 opacity-50" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg active:scale-90"}`}
              >
                {isLoading ? (
                  <svg
                    className="animate-spin h-5 w-5 md:h-6 md:w-6"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="md:w-6 md:h-6"
                  >
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                  </svg>
                )}
              </button>
            </div>
            <p className="text-center text-[8px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-600 mt-4 opacity-70">
              CondoScout AI can make mistakes &middot; always verify details
              with official sources
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
