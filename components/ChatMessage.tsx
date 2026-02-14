
import React, { useState } from 'react';
import { Message } from '../types';
import PlaceCard from './PlaceCard';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
  userAvatar?: string;
}

const FallbackBearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full p-1.5 text-slate-400 dark:text-slate-500" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 10v4a5 5 0 0 1 10 0v-4" />
    <path d="M2 12a10 10 0 1 1 20 0 10 10 0 0 1-20 0z" />
    <circle cx="9" cy="11" r="1" />
    <circle cx="15" cy="11" r="1" />
    <path d="M12 13v1" />
  </svg>
);

const ChatMessage: React.FC<ChatMessageProps> = ({ message, userAvatar }) => {
  const isUser = message.role === 'user';
  const hasPlaces = message.places && message.places.length > 0;
  const [imageError, setImageError] = useState(false);

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3 md:gap-4`}>
      {/* Avatar Section */}
      <div className="shrink-0">
        {isUser ? (
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center">
            {!imageError ? (
              <img 
                src={userAvatar} 
                alt="User" 
                className="w-full h-full object-cover" 
                onError={() => setImageError(true)}
              />
            ) : (
              <FallbackBearIcon />
            )}
          </div>
        ) : (
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200/50 dark:shadow-none border border-indigo-400/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
        )}
      </div>

      {/* Content Wrapper */}
      <div className={`flex flex-col flex-1 min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-500 mb-1 px-1 uppercase tracking-wider">
          {isUser ? 'You' : 'Royce'}
        </span>

        {/* Text Bubble */}
        <div className={`px-4 py-3 md:px-5 md:py-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words transition-colors duration-300 w-fit max-w-full
            ${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none'}`}>
          {message.isThinking ? (
            <div className="flex flex-col space-y-3 min-w-[180px] py-1">
                <div className="flex items-center space-x-2 text-indigo-500 dark:text-indigo-400">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-[10px] font-semibold uppercase tracking-widest animate-pulse">Scouting...</span>
                </div>
            </div>
          ) : (
            <ReactMarkdown 
              components={{
                a: ({node, ...props}) => <a {...props} className="underline font-semibold hover:text-blue-200 dark:hover:text-blue-400" target="_blank" rel="noopener noreferrer" />,
                p: ({node, ...props}) => <p {...props} className="mb-2 last:mb-0" />,
                strong: ({node, ...props}) => <strong {...props} className="font-bold text-slate-900 dark:text-white" />
              }}
            >
                {message.text}
            </ReactMarkdown>
          )}
        </div>

        {!isUser && hasPlaces && (
          <div className="mt-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
             <div className="flex space-x-4 overflow-x-auto pb-4 pt-1 snap-x px-2 -mx-2 scrollbar-hide">
                {message.places?.map((place, idx) => (
                  <PlaceCard key={`${place.placeId}-${idx}`} place={place} />
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
