
import React, { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
  audioBuffer: AudioBuffer | null;
  isPlaying: boolean;
  currentTime: number;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioBuffer, isPlaying, currentTime }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;

      for (let i = 0; i < canvas.width; i++) {
        const min = Math.min(...data.slice(i * step, (i + 1) * step));
        const max = Math.max(...data.slice(i * step, (i + 1) * step));
        const x = i;
        const yMin = (1 + min) * amp;
        const yMax = (1 + max) * amp;
        ctx.moveTo(x, yMin);
        ctx.lineTo(x, yMax);
      }
      ctx.stroke();

      // Draw progress indicator
      const progress = (currentTime / audioBuffer.duration) * canvas.width;
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.moveTo(progress, 0);
      ctx.lineTo(progress, canvas.height);
      ctx.stroke();
    };

    draw();
  }, [audioBuffer, currentTime]);

  return (
    <div className="w-full h-32 bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700 relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={128}
        className="w-full h-full"
      />
      {!audioBuffer && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 italic text-sm">
          No audio generated yet
        </div>
      )}
    </div>
  );
};

export default AudioVisualizer;
