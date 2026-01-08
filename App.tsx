
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceName, VoxagenConfig } from './types';
import ConfigUploader from './components/ConfigUploader';
import AudioVisualizer from './components/AudioVisualizer';
import { generateSpeech } from './services/geminiService';

const App: React.FC = () => {
  const [config, setConfig] = useState<VoxagenConfig | null>(null);
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<VoiceName>(VoiceName.Zephyr);
  const [loading, setLoading] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  const handleConfigLoaded = (newConfig: VoxagenConfig) => {
    setConfig(newConfig);
  };

  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const handleGenerate = async () => {
    if (!text.trim() || !config) return;

    try {
      setLoading(true);
      stopAudio();
      
      // The generateSpeech function uses the @google/genai TTS model
      const buffer = await generateSpeech(text, voice);
      
      setAudioBuffer(buffer);
      setCurrentTime(0);
      pausedAtRef.current = 0;
      
      // Auto-play the newly generated audio
      playAudioFromBuffer(buffer);
    } catch (error) {
      console.error(error);
      alert('Synthesis failed. Please verify your API Key and Network connection.');
    } finally {
      setLoading(false);
    }
  };

  const playAudioFromBuffer = (buffer: AudioBuffer) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    startTimeRef.current = ctx.currentTime;
    source.start(0);
    sourceNodeRef.current = source;
    setIsPlaying(true);

    source.onended = () => {
      if (sourceNodeRef.current === source) {
        setIsPlaying(false);
        setCurrentTime(0);
        pausedAtRef.current = 0;
      }
    };
  };

  const playAudio = useCallback(() => {
    if (!audioBuffer) return;
    playAudioFromBuffer(audioBuffer);
  }, [audioBuffer]);

  const togglePlay = () => {
    if (isPlaying) {
      if (audioContextRef.current) {
        pausedAtRef.current = audioContextRef.current.currentTime - startTimeRef.current;
      }
      stopAudio();
    } else {
      playAudio();
    }
  };

  useEffect(() => {
    let interval: number;
    if (isPlaying && audioContextRef.current) {
      interval = window.setInterval(() => {
        const current = audioContextRef.current!.currentTime - startTimeRef.current;
        setCurrentTime(Math.min(current, audioBuffer?.duration || 0));
      }, 16); // 60fps tracking
    }
    return () => clearInterval(interval);
  }, [isPlaying, audioBuffer]);

  return (
    <div className="min-h-screen p-4 md:p-12 flex flex-col items-center max-w-5xl mx-auto">
      {/* Header Branding */}
      <header className="w-full flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-6xl font-black tracking-tighter bg-gradient-to-br from-white via-blue-400 to-indigo-600 bg-clip-text text-transparent italic">
            VOXAGEN
          </h1>
          <p className="text-slate-500 font-bold tracking-[0.5em] text-[10px] mt-1 ml-1 uppercase">Gen-Audio HD Synthesis</p>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Protocol Status</span>
            <span className={`text-xs font-black tracking-wide ${config ? 'text-emerald-400' : 'text-rose-500'}`}>
              {config ? 'SECURE_UPLINK_READY' : 'AUTH_GATED_LOCK'}
            </span>
          </div>
          <div className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-all duration-700 ${config ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 ${!config ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        </div>
      </header>

      {/* Security Layer */}
      <div className="w-full mb-12">
        <ConfigUploader onConfigLoaded={handleConfigLoaded} config={config} />
      </div>

      {/* Main Interface */}
      <main className={`w-full transition-all duration-1000 transform ${!config ? 'scale-95 opacity-5 pointer-events-none blur-xl' : 'scale-100 opacity-100 blur-0'}`}>
        <div className="glass rounded-[3rem] p-10 shadow-[0_0_100px_-30px_rgba(30,41,59,0.5)] border border-white/5 space-y-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Input Section */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between px-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Manuscript Stream</label>
                <div className="flex gap-1.5">
                   <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                   <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                   <div className="h-1.5 w-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                </div>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Initialize synthesis input..."
                className="w-full h-72 bg-slate-950/40 border border-slate-800/50 rounded-[2rem] p-8 text-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 outline-none transition-all placeholder:text-slate-800 resize-none text-xl font-light leading-relaxed tracking-tight"
              />
            </div>

            {/* Controls Section */}
            <div className="lg:col-span-4 flex flex-col justify-between space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] px-4">Vocal Identity</label>
                <div className="grid grid-cols-1 gap-2.5">
                  {Object.values(VoiceName).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVoice(v)}
                      className={`group flex items-center justify-between px-6 py-4.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                        voice === v 
                          ? 'bg-blue-600 text-white shadow-2xl shadow-blue-900/40 translate-x-2' 
                          : 'bg-slate-900/30 text-slate-500 border border-slate-800/50 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <span>{v} Profile</span>
                      <div className={`w-2 h-2 rounded-full ${voice === v ? 'bg-white' : 'bg-slate-800 group-hover:bg-slate-600'}`}></div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || !text.trim()}
                className="group relative w-full overflow-hidden h-24 bg-gradient-to-br from-blue-600 to-indigo-700 disabled:from-slate-900 disabled:to-slate-950 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.03] active:scale-95 shadow-2xl shadow-blue-900/30 border border-white/10"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex items-end gap-1 h-6">
                      <div className="w-1.5 h-3 bg-white animate-[bounce_0.6s_infinite] [animation-delay:-0.4s]"></div>
                      <div className="w-1.5 h-6 bg-white animate-[bounce_0.6s_infinite] [animation-delay:-0.2s]"></div>
                      <div className="w-1.5 h-4 bg-white animate-[bounce_0.6s_infinite]"></div>
                    </div>
                    <span className="text-sm">Synthesizing...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transition-transform group-hover:scale-125" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    <span className="text-sm">Initiate Wave</span>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Visualization Section */}
          <div className="pt-10 border-t border-slate-800/30">
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-slate-700'}`}></div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">Spectrum Resolution Analysis</h4>
              </div>
              
              {audioBuffer && (
                <div className="flex items-center gap-6 glass px-6 py-3 rounded-2xl border-white/5">
                  <span className="text-[10px] font-mono font-bold text-slate-500 tracking-tighter">
                    <span className="text-blue-400">{currentTime.toFixed(2)}s</span> / {audioBuffer.duration.toFixed(2)}s
                  </span>
                  <div className="h-4 w-px bg-slate-800"></div>
                  <button 
                    onClick={togglePlay}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-colors"
                  >
                    {isPlaying ? (
                      <><div className="flex gap-1"><div className="w-1 h-3 bg-current"></div><div className="w-1 h-3 bg-current"></div></div> Pause</>
                    ) : (
                      <><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg> Resume</>
                    )}
                  </button>
                </div>
              )}
            </div>
            
            <AudioVisualizer 
              audioBuffer={audioBuffer} 
              isPlaying={isPlaying} 
              currentTime={currentTime} 
            />
          </div>
        </div>
      </main>

      {/* Footer System Info */}
      <footer className="mt-20 text-slate-700 text-[9px] font-black tracking-[0.5em] uppercase flex flex-wrap justify-center gap-10 text-center">
        <span className="hover:text-slate-500 transition-colors cursor-default">Engine v24.2.0</span>
        <span className="hover:text-slate-500 transition-colors cursor-default">PCM_FLOAT_32_BIT</span>
        <span className="hover:text-slate-500 transition-colors cursor-default">Chirp-3_HD_Uplink</span>
      </footer>
    </div>
  );
};

export default App;
