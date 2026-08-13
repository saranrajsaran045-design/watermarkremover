import React, { useState } from 'react';
import { Video, Image as ImageIcon, Sparkles } from 'lucide-react';
import { PhotoStudio } from './components/PhotoStudio';

function App() {
  const [activeTab, setActiveTab] = useState<'video' | 'photo'>('video');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-gray-100 flex flex-col">
      {/* Top Header & Navigation Bar */}
      <header className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              AI Watermark Studio
            </h1>
            <p className="text-xs text-gray-400">
              100% Local AI Video & Photo Watermark Removal + 4K Enhancement
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-950 p-1.5 rounded-xl border border-gray-800">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'video'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
            }`}
          >
            <Video className="w-4 h-4" />
            Video Studio
          </button>
          <button
            onClick={() => setActiveTab('photo')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'photo'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Photo Studio (4K)
          </button>
        </div>
      </header>

      {/* Main Workspace Content */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'video' ? (
          <div className="w-full flex-1">
            <iframe
              src="/video-preview.html"
              className="w-full h-[calc(100vh-80px)] border-none"
              title="Gemini Video Watermark Remover"
            />
          </div>
        ) : (
          <div className="max-w-6xl w-full mx-auto p-6 flex-1 flex flex-col justify-center">
            <PhotoStudio />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
