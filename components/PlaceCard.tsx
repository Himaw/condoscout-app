import React, { useState } from 'react';
import { PlaceData } from '../types';

interface PlaceCardProps {
  place: PlaceData;
}

const PlaceCard: React.FC<PlaceCardProps> = ({ place }) => {
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Construct query for the map
  // Use address if available for better precision, otherwise title
  const query = encodeURIComponent(`${place.title} ${place.address || ''}`);
  
  // Google Maps Embed URL (Legacy/Search mode)
  // t=h (Hybrid: Satellite + Labels), z=17 (Zoom level for building view)
  const mapEmbedUrl = `https://maps.google.com/maps?q=${query}&t=h&z=17&ie=UTF8&iwloc=&output=embed`;

  const handleMapClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (place.uri) {
      window.open(place.uri, '_blank');
    }
  };

  const handleDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const searchQuery = `${place.title} ${place.address || ''} official website rent price agent`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    window.open(searchUrl, '_blank');
  };

  return (
    <div className="group relative flex flex-col min-w-[300px] max-w-[320px] bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300 overflow-hidden shrink-0 snap-center">
      
      {/* Visual Section: Satellite Map Embed */}
      <div className="relative h-48 bg-slate-100 dark:bg-slate-900 overflow-hidden">
        
        {/* Loading Skeleton */}
        {!isMapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 animate-pulse">
            <svg className="w-8 h-8 text-slate-300 dark:text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}

        {/* The Map Iframe */}
        <iframe
          title={`Map view of ${place.title}`}
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={mapEmbedUrl}
          onLoad={() => setIsMapLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-500 ${isMapLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ pointerEvents: 'none' }} // Disable interaction within the tile to keep it scrollable/clickable as a card
        />

        {/* Overlay Gradient for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent pointer-events-none"></div>

        {/* Badge */}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider border border-white/10 shadow-sm z-10">
          Satellite View
        </div>

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white z-10 pointer-events-none">
          <h3 className="font-bold text-lg leading-tight shadow-sm truncate">{place.title}</h3>
          {place.address && (
             <p className="text-xs text-slate-300 truncate mt-0.5 font-medium">{place.address}</p>
          )}
        </div>
      </div>
      
      {/* Content Section */}
      <div className="p-4 flex flex-col grow bg-white dark:bg-slate-800 transition-colors duration-300">
        <div className="mb-4 grow">
           {place.description ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
              "{place.description}"
            </p>
           ) : (
             <p className="text-sm text-slate-400 dark:text-slate-500 italic">Explore this location for more details.</p>
           )}
        </div>
        
        {/* Action Buttons */}
        <div className="mt-auto grid grid-cols-2 gap-2">
            <button 
                onClick={handleMapClick}
                className="py-2.5 px-3 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 active:bg-slate-200 dark:active:bg-slate-500 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-2"
                title="Open in Google Maps"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                <span>Directions</span>
            </button>
            <button 
                onClick={handleDetailsClick}
                className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-sm"
                title="Search for agents and details"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                <span>Details / Agent</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default PlaceCard;