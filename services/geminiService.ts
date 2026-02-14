import { GoogleGenAI, Chat, Content } from "@google/genai";
import { GroundingChunk, PlaceData, Location, Message } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let chatSession: Chat | null = null;

const SYSTEM_INSTRUCTION = `You are Royce, an elite Real Estate and Lifestyle Concierge.
Your mission is to assist users in discovering the perfect condominiums, apartments, or hotels tailored to their specific lifestyle and needs.

RULES:
1. You MUST use the 'googleMaps' tool to find real-world locations that match the user's criteria.
2. When a user specifies a budget (e.g., "20000 THB"), try to find places that likely fit that category or politely explain you are showing the best matches in the area.
3. Provide a sophisticated, concise summary of *why* you selected these properties.
4. If the user asks for "apartments" or "condos", look for residential buildings or serviced apartments.
5. If the user asks for "hotels", look for hotels.
6. Always include the location context (e.g., "located near the BTS", "in the heart of Siam").
7. Tone: Professional, polite, knowledgeable, and slightly upscale (like a high-end concierge).

When you return places, the UI will display them as cards with a SATELLITE MAP VIEW of the location. 
Ensure the places you find are specific buildings or hotels so the map pin is accurate.`;

export const startNewChat = () => {
  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleMaps: {} }],
    },
  });
};

export const resumeChat = (history: Message[]) => {
  // Filter out thinking messages and map to Gemini Content format
  const validHistory: Content[] = history
    .filter(msg => !msg.isThinking && msg.id !== 'welcome') // Remove system welcome/thinking
    .map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleMaps: {} }],
    },
    history: validHistory
  });
};

export const sendMessageToGemini = async (
  message: string, 
  userLocation?: Location
): Promise<{ text: string; places: PlaceData[] }> => {
  if (!chatSession) {
    startNewChat();
  }

  if (!chatSession) {
      throw new Error("Failed to initialize chat session");
  }

  try {
    const result = await chatSession.sendMessage({
      message: message,
    });

    const text = result.text;
    
    // Extract Grounding Chunks (Places)
    const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
    const places: PlaceData[] = [];

    if (chunks) {
      chunks.forEach((chunk) => {
        if (chunk.maps) {
          const mapData = chunk.maps;
          const uri = mapData.uri || mapData.googleMapsUri || "";
          if (mapData.title && uri) {
             // Extract a snippet if available
             const snippet = mapData.placeAnswerSources?.reviewSnippets?.[0]?.content;

             places.push({
               title: mapData.title,
               uri: uri,
               placeId: mapData.placeId,
               description: snippet,
               address: mapData.address 
             });
          }
        }
      });
    }

    // Filter duplicates based on title
    const uniquePlaces = places.filter((v, i, a) => a.findIndex(t => (t.title === v.title)) === i);

    return {
      text: text || "I've curated a list of properties for you:",
      places: uniquePlaces,
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      text: "I apologize, but I am unable to access the property database at this moment. Please try again shortly.",
      places: [],
    };
  }
};