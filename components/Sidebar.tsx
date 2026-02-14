
import React from 'react';
import { ChatSession } from '../types';

interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (e: React.MouseEvent, id: string) => void;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  isMobile,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClose,
}) => {
  // Determine sidebar classes based on state
  // Mobile: Fixed overlay
  // Desktop: Relative width transition
  const baseClasses = "bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ease-in-out h-full z-30";
  
  const widthClass = isOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full opacity-0 overflow-hidden";
  
  const mobileClasses = isMobile 
    ? `fixed inset-y-0 left-0 shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full'}` 
    : `relative ${widthClass}`;

  // If mobile and open, show backdrop
  const showBackdrop = isMobile && isOpen;

  return (
    <>
      {/* Mobile Backdrop */}
      {showBackdrop && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <aside className={`${baseClasses} ${mobileClasses}`}>
        {/* Header / New Chat */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={() => {
              onNewChat();
              if (isMobile) onClose();
            }}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white py-3 px-4 rounded-xl font-medium transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>New Search</span>
          </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {sessions.length === 0 ? (
            <div className="text-center py-10 px-4">
              <p className="text-sm text-slate-400 dark:text-slate-500">No search history yet.</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => {
                  onSelectSession(session.id);
                  if (isMobile) onClose();
                }}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 border border-transparent
                  ${currentSessionId === session.id 
                    ? 'bg-white dark:bg-slate-800 shadow-sm border-slate-200 dark:border-slate-700' 
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                  }`}
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className={`shrink-0 w-2 h-2 rounded-full ${currentSessionId === session.id ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                  <div className="flex flex-col overflow-hidden">
                    <span className={`text-sm font-medium truncate ${currentSessionId === session.id ? 'text-slate-900 dark:text-slate-100' : ''}`}>
                      {session.title || "New Chat"}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      {new Date(session.lastUpdated).toLocaleDateString()} &middot; {new Date(session.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => onDeleteSession(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-all"
                  title="Delete chat"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-600 text-center">
           CondoScout v1.0
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
