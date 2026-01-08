
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

// --- Types ---

enum VoiceName {
  Kore = 'Kore',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}

interface VoxagenConfig {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain?: string;
}

// --- Utils ---

function decodeBase64(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeRawPcm(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

// --- Components ---

const AudioVisualizer: React.FC<{
  buffer: AudioBuffer | null;
  currentTime: number;
}> = ({ buffer, currentTime }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (!buffer) return;

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;

    for (let i = 0; i < width; i++) {
      const slice = data.slice(i * step, (i + 1) * step);
      const min = slice.length ? Math.min(...slice) : 0;
      const max = slice.length ? Math.max(...slice) : 0;
      ctx.moveTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();

    const progress = (currentTime / buffer.duration) * width;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.fillRect(0, 0, progress, height);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(progress, 0);
    ctx.lineTo(progress, height);
    ctx.stroke();
  }, [buffer, currentTime]);

  return (
    <div className="w-full h-full bg-slate-950/60 rounded-2xl border border-slate-800/50 relative overflow-hidden">
      <canvas ref={canvasRef} width={1200} height={160} className="w-full h-full" />
      {!buffer && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-700 font-black text-[10px] uppercase tracking-[0.4em]">
          Signal Offline
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [config, setConfig] = useState<VoxagenConfig | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<VoiceName>(VoiceName.Zephyr);
  const [loading, setLoading] = useState(false);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const handleSynthesize = async () => {
    if (!text.trim() || !config) return;
    try {
      setLoading(true);
      stop();
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      });
      const raw = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!raw) throw new Error("NULL_SIGNAL");
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      const audioBuffer = await decodeRawPcm(decodeBase64(raw), audioCtxRef.current);
      setBuffer(audioBuffer);
      setCurrentTime(0);
      pausedAtRef.current = 0;
      play(audioBuffer);
    } catch (e) {
      alert("Error Synthesizing Signal.");
    } finally {
      setLoading(false);
    }
  };

  const play = (b: AudioBuffer) => {
    const ctx = audioCtxRef.current!;
    if (ctx.state === 'suspended') ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = b;
    source.connect(ctx.destination);
    startTimeRef.current = ctx.currentTime;
    source.start(0);
    sourceRef.current = source;
    setIsPlaying(true);
    source.onended = () => {
      if (sourceRef.current === source) {
        setIsPlaying(false);
        setCurrentTime(0);
        pausedAtRef.current = 0;
      }
    };
  };

  const togglePlayback = () => {
    if (isPlaying) {
      pausedAtRef.current = audioCtxRef.current!.currentTime - startTimeRef.current;
      stop();
    } else if (buffer) {
      const ctx = audioCtxRef.current!;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const offset = pausedAtRef.current;
      startTimeRef.current = ctx.currentTime - offset;
      source.start(0, offset);
      sourceRef.current = source;
      setIsPlaying(true);
      source.onended = () => { if (sourceRef.current === source) setIsPlaying(false); };
    }
  };

  useEffect(() => {
    let interval: number;
    if (isPlaying) {
      interval = window.setInterval(() => {
        const c = audioCtxRef.current!.currentTime - startTimeRef.current;
        setCurrentTime(Math.min(c, buffer?.duration || 0));
      }, 16);
    }
    return () => clearInterval(interval);
  }, [isPlaying, buffer]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target?.result as string);
          if (json.project_id && json.private_key) {
            setConfig(json);
            setIsConfigOpen(false);
          } else alert("Invalid GCP Key Format.");
        } catch { alert("JSON Parsing Error."); }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="h-full w-full flex flex-col p-6 md:p-8 bg-[#020617] relative">
      
      {/* Sidebar Key Icon */}
      <button 
        onClick={() => setIsConfigOpen(!isConfigOpen)}
        className={`fixed left-6 bottom-6 md:left-8 md:bottom-8 z-50 w-12 h-12 rounded-full flex items-center justify-center transition-all ${config ? 'bg-blue-600 shadow-lg shadow-blue-500/30' : 'bg-slate-800 pulse-blue'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </button>

      {/* Config Overlay Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass max-w-md w-full p-8 rounded-[2.5rem] shadow-2xl relative">
            <button onClick={() => setIsConfigOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
            <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tight italic">Inject Auth Key</h2>
            <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">System requires Google Cloud Service Account JSON for HD Chirp-3 Uplink.</p>
            <input type="file" ref={fileInputRef} onChange={handleFile} accept=".json" className="hidden" />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-900/40"
            >
              {config ? 'Replace Key' : 'Upload JSON'}
            </button>
            {config && <div className="mt-4 text-[10px] text-emerald-400 font-black text-center uppercase tracking-widest">Active: {config.project_id}</div>}
          </div>
        </div>
      )}

      {/* Main Dashboard Layout */}
      <div className={`flex-1 flex flex-col gap-6 transition-all duration-700 ${!config ? 'blur-2xl opacity-10 pointer-events-none' : 'opacity-100'}`}>
        
        {/* Top Header */}
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-5xl font-black italic tracking-tighter bg-gradient-to-br from-white via-slate-400 to-blue-600 bg-clip-text text-transparent leading-none">VOXAGEN</h1>
            <p className="text-[10px] font-black tracking-[0.6em] text-slate-500 uppercase mt-2 ml-1">Hyper-Fi Synthesis Core</p>
          </div>
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Protocol</span>
            <span className="text-xs font-black text-blue-400 tracking-tight italic">SECURE_UPLINK_09</span>
          </div>
        </header>

        {/* Content Section: Workspace */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
          
          {/* Manuscript Card */}
          <div className="lg:col-span-8 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Manuscript Stream</span>
              <div className="flex gap-1">
                {[1,2,3].map(i => <div key={i} className="h-1 w-3 rounded-full bg-blue-600/20"></div>)}
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Initialize manuscript..."
              className="flex-1 w-full bg-slate-950/40 border border-slate-800/40 rounded-[2rem] p-8 text-slate-100 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-800 text-xl font-light leading-relaxed resize-none shadow-inner overflow-hidden focus:overflow-auto"
            />
          </div>

          {/* Controls Card */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] px-2">Voice Matrix</span>
              <div className="grid grid-cols-1 gap-2">
                {Object.values(VoiceName).map(v => (
                  <button
                    key={v}
                    onClick={() => setVoice(v)}
                    className={`flex items-center justify-between px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${voice === v ? 'bg-blue-600 text-white border-blue-400 shadow-lg translate-x-1' : 'bg-slate-900/30 text-slate-600 border-slate-800/50 hover:text-slate-400'}`}
                  >
                    <span>{v} UNIT</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${voice === v ? 'bg-white' : 'bg-slate-800'}`}></div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSynthesize}
              disabled={loading || !text.trim()}
              className="mt-auto h-24 bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2rem] text-white font-black uppercase tracking-[0.4em] transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-blue-600/20 border border-white/10 disabled:grayscale disabled:opacity-50"
            >
              {loading ? 'Synthesizing...' : 'Synthesize'}
            </button>
          </div>
        </div>

        {/* Visualization & Player Bar */}
        <div className="h-44 flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${isPlaying ? 'bg-blue-500 shadow-[0_0_10px_#3b82f6]' : 'bg-slate-800'}`}></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">Spectrum Resolution</span>
            </div>
            {buffer && (
              <div className="flex items-center gap-6 glass px-6 py-2 rounded-full border-white/5">
                <span className="text-[10px] font-mono font-bold text-blue-400">{currentTime.toFixed(2)}s <span className="text-slate-700">/</span> {buffer.duration.toFixed(2)}s</span>
                <button onClick={togglePlayback} className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-all">
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
              </div>
            )}
          </div>
          <AudioVisualizer buffer={buffer} currentTime={currentTime} />
        </div>

      </div>

      {/* Air-gapped State Indicator */}
      {!config && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <div className="w-20 h-20 rounded-[2rem] bg-slate-900 border border-slate-800 flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-[0.3em] mb-2">Interface Locked</h2>
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.6em]">Awaiting Uplink Protocol</p>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
