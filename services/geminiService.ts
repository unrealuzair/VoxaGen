
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName } from "../types";
import { decode, decodeAudioData } from "../utils/audioUtils";

export const generateSpeech = async (text: string, voice: VoiceName): Promise<AudioBuffer> => {
  // Always initialize with the environment key as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (!base64Audio) {
    throw new Error("Critical: No audio data signature found in API response.");
  }

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const decodedData = decode(base64Audio);
  
  // The Gemini TTS API returns raw PCM 16-bit at 24kHz
  return await decodeAudioData(decodedData, audioContext, 24000, 1);
};
