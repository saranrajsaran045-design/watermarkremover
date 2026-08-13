import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Download, XCircle, Loader2 } from 'lucide-react';
import { VideoProcessor } from '../lib/videoPipeline';

interface Props {
  file: File;
  onCancel: () => void;
}

export function ProcessingDashboard({ file, onCancel }: Props) {
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  
  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const processorRef = useRef<VideoProcessor | null>(null);

  useEffect(() => {
    if (originalVideoRef.current) {
      originalVideoRef.current.src = URL.createObjectURL(file);
    }
    return () => {
      if (originalVideoRef.current?.src) {
        URL.revokeObjectURL(originalVideoRef.current.src);
      }
      if (processorRef.current) {
        processorRef.current.stop();
      }
    };
  }, [file]);

  const startProcessing = async () => {
    if (!processedCanvasRef.current) return;
    setIsProcessing(true);
    setProgress(0);
    
    processorRef.current = new VideoProcessor(
      file,
      processedCanvasRef.current,
      (p) => setProgress(p),
      (url) => {
        setIsProcessing(false);
        setIsDone(true);
        setDownloadUrl(url);
        setProgress(100);
      }
    );
    
    await processorRef.current.start();
  };

  const handleCancel = () => {
    if (processorRef.current) {
      processorRef.current.stop();
    }
    onCancel();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          Processing Studio
        </h2>
        <button 
          onClick={handleCancel}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
          title="Cancel"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Original */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Original Video</h3>
          <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-inner flex items-center justify-center relative">
            <video 
              ref={originalVideoRef} 
              className="w-full h-full object-contain"
              controls 
              muted 
              playsInline 
            />
          </div>
        </div>

        {/* Processed */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider flex justify-between">
            <span>Processed Output</span>
            {isProcessing && <span className="text-cyan-400 text-xs flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Processing...</span>}
          </h3>
          <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-inner flex items-center justify-center relative">
            <canvas 
              ref={processedCanvasRef}
              className="w-full h-full object-contain"
            />
            {!isProcessing && !isDone && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                <button 
                  onClick={startProcessing}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-full shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Start Processing
                </button>
                <p className="mt-3 text-xs text-gray-400">Processes locally in your browser</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress & Actions */}
      {(isProcessing || isDone) && (
        <div className="bg-gray-800/80 rounded-xl p-6 border border-gray-700/50">
          <div className="mb-2 flex justify-between text-sm font-medium">
            <span className="text-cyan-400">Processing Progress</span>
            <span className="text-gray-300">{progress}%</span>
          </div>
          <div className="w-full bg-gray-900 rounded-full h-2.5 mb-6 overflow-hidden border border-gray-700">
            <div 
              className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2.5 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {isDone && (
            <div className="flex justify-center">
              <a 
                href={downloadUrl!}
                download={`cleaned_${file.name.replace(/\.[^/.]+$/, "")}.webm`}
                className="bg-green-500 hover:bg-green-400 text-gray-900 font-bold py-3 px-8 rounded-full shadow-lg shadow-green-500/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                <Download className="w-5 h-5" />
                Download Video
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
