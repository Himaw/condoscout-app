export interface Location {
  latitude: number;
  longitude: number;
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
  maps?: {
    googleMapsUri?: string; // Sometimes returned as uri or googleMapsUri depending on exact version
    uri?: string;
    title?: string;
    placeId?: string;
    address?: string; // Sometimes inferred or part of snippet
    placeAnswerSources?: {
        reviewSnippets?: {
            content?: string;
        }[]
    }
  };
}

export interface PlaceData {
  title: string;
  uri: string;
  address?: string;
  description?: string;
  placeId?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  places?: PlaceData[];
  isThinking?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  lastUpdated: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}