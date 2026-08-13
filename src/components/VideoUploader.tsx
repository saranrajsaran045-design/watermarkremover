import React, { useCallback, useState } from 'react';
import { UploadCloud, FileVideo, AlertCircle } from 'lucide-react';

interface Props {
  onFileAccepted: (file: File) => void;
}

export function VideoUploader({ onFileAccepted }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const validateAndAccept = (file: File) => {
    if (file.type.startsWith('video/')) {
      setError(null);
      onFileAccepted(file);
    } else {
      setError('Please upload a valid video file (MP4, WebM, MOV).');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndAccept(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndAccept(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <div
        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out cursor-pointer ${
          isDragging 
            ? 'border-cyan-400 bg-cyan-400/10 scale-[1.02]' 
            : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/80'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleChange}
        />
        <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
          <UploadCloud className={`w-12 h-12 mb-4 ${isDragging ? 'text-cyan-400' : 'text-gray-400'}`} />
          <p className="mb-2 text-sm text-gray-300 font-semibold">
            <span className="text-cyan-400">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">MP4, WebM or MOV (max. 100MB for testing)</p>
        </div>
      </div>
      
      {error && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
    </div>
  );
}
