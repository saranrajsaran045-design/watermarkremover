import { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Sparkles,
  Download,
  Sliders,
  Loader2,
  Scissors,
  Palette,
  Layers,
  Check,
  RefreshCw,
} from 'lucide-react';
import { processPhoto, type EnhanceOptions } from '../lib/photoEnhancer';
import { type BgMode } from '../lib/backgroundRemover';

const COLOR_PRESETS = [
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Off-White', hex: '#F3F4F6' },
  { name: 'Studio Dark', hex: '#111827' },
  { name: 'Pure Black', hex: '#000000' },
  { name: 'Studio Blue', hex: '#2563EB' },
  { name: 'Neon Mint', hex: '#10B981' },
  { name: 'Cyber Purple', hex: '#7C3AED' },
  { name: 'Sunset Coral', hex: '#F43F5E' },
  { name: 'Green Screen', hex: '#00FF00' },
];

export function PhotoStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultDims, setResultDims] = useState<{ width: number; height: number } | null>(null);
  const [isTransparentResult, setIsTransparentResult] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Enhancement Toggles & Controls
  const [removeWatermark, setRemoveWatermark] = useState(true);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [bgMode, setBgMode] = useState<BgMode>('transparent');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [blurRadius, setBlurRadius] = useState(20);
  const [customBgFile, setCustomBgFile] = useState<File | null>(null);
  const [customBgPreview, setCustomBgPreview] = useState<string | null>(null);

  // 4K & Quality settings
  const [upscaleTo4K, setUpscaleTo4K] = useState(true);
  const [sharpenStrength, setSharpenStrength] = useState(0.4);
  const [contrastBoost, setContrastBoost] = useState(0.2);

  const customBgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setOriginalUrl(url);
      setResultUrl(null);
      setResultDims(null);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  useEffect(() => {
    if (customBgFile) {
      const url = URL.createObjectURL(customBgFile);
      setCustomBgPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCustomBgPreview(null);
    }
  }, [customBgFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (dropped.type.startsWith('image/')) {
        setFile(dropped);
      }
    }
  };

  const handleCustomBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCustomBgFile(e.target.files[0]);
      setBgMode('custom');
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    setStatusMsg('Initializing AI models...');

    try {
      const options: EnhanceOptions = {
        removeWatermark,
        removeBackground,
        bgOptions: {
          mode: bgMode,
          color: bgColor,
          blurRadius,
          customBgFile,
        },
        upscaleTo4K,
        sharpenStrength,
        contrastBoost,
      };

      const res = await processPhoto(file, options, (msg) => setStatusMsg(msg));
      setResultUrl(res.blobUrl);
      setResultDims({ width: res.width, height: res.height });
      setIsTransparentResult(res.isTransparent);
      setStatusMsg('Enhancement Complete!');
    } catch (err: any) {
      console.error(err);
      setStatusMsg(err?.message || 'Processing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick preset helper
  const applyPreset = (preset: 'bgOnly' | 'watermarkOnly' | 'all') => {
    if (preset === 'bgOnly') {
      setRemoveBackground(true);
      setBgMode('transparent');
      setRemoveWatermark(false);
      setUpscaleTo4K(true);
    } else if (preset === 'watermarkOnly') {
      setRemoveBackground(false);
      setRemoveWatermark(true);
      setUpscaleTo4K(true);
    } else if (preset === 'all') {
      setRemoveBackground(true);
      setRemoveWatermark(true);
      setUpscaleTo4K(true);
    }
  };

  return (
    <div className="w-full space-y-6">
      {!file ? (
        /* Upload Area */
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-gray-700 hover:border-cyan-500 rounded-3xl p-12 text-center bg-gray-900/40 backdrop-blur-md transition-all cursor-pointer group shadow-2xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none" />
          
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            id="photo-upload"
            onChange={handleFileChange}
          />
          <label htmlFor="photo-upload" className="cursor-pointer flex flex-col items-center relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-cyan-500/25 transition-all">
              <UploadCloud className="w-10 h-10" />
            </div>
            
            <h3 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-300 mb-2">
              Upload Photo for AI Background & Watermark Removal
            </h3>
            
            <p className="text-sm text-gray-400 max-w-lg mx-auto mb-6 leading-relaxed">
              100% private, on-device AI. Remove background cutouts, erase watermarks, replace backdrops, and upscale to crisp 4K Ultra HD in seconds.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              <span className="text-xs px-3 py-1 bg-gray-800 text-cyan-400 rounded-full border border-cyan-500/20">
                ✨ AI Background Cutout
              </span>
              <span className="text-xs px-3 py-1 bg-gray-800 text-blue-400 rounded-full border border-blue-500/20">
                🎨 Backdrop Colors & Blur
              </span>
              <span className="text-xs px-3 py-1 bg-gray-800 text-amber-400 rounded-full border border-amber-500/20">
                ⚡ Watermark Eraser
              </span>
              <span className="text-xs px-3 py-1 bg-gray-800 text-purple-400 rounded-full border border-purple-500/20">
                💎 4K Upscaler
              </span>
            </div>

            <span className="px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-full shadow-lg shadow-cyan-500/25 text-sm transition-all hover:scale-105 active:scale-95">
              Select Image from Computer
            </span>
          </label>
        </div>
      ) : (
        /* Processing Studio */
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-100 truncate max-w-xs sm:max-w-md">{file.name}</h2>
                <p className="text-xs text-gray-400">{(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI processing</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFile(null)}
                className="text-xs text-gray-300 hover:text-white bg-gray-800/80 hover:bg-gray-700 px-3.5 py-2 rounded-xl border border-gray-700 transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Change Image
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-gray-400 font-semibold uppercase tracking-wider text-[11px] mr-1">Quick Modes:</span>
            <button
              type="button"
              onClick={() => applyPreset('bgOnly')}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                removeBackground && !removeWatermark
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-medium'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              ✂️ Background Cutout
            </button>
            <button
              type="button"
              onClick={() => applyPreset('watermarkOnly')}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                removeWatermark && !removeBackground
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-medium'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              🧹 Watermark Remover
            </button>
            <button
              type="button"
              onClick={() => applyPreset('all')}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                removeBackground && removeWatermark
                  ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-medium'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              🚀 All-in-One Studio (BG + Watermark + 4K)
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Options Panel (Left) */}
            <div className="lg:col-span-5 bg-gray-900/70 backdrop-blur-xl rounded-2xl p-5 border border-gray-800 space-y-5 h-fit shadow-xl">
              <h3 className="text-xs font-bold text-gray-300 flex items-center gap-2 uppercase tracking-wider border-b border-gray-800 pb-3">
                <Sliders className="w-4 h-4 text-cyan-400" />
                AI Studio Controls
              </h3>

              {/* 1. Background Remover Section */}
              <div className="space-y-3 bg-gray-950/60 rounded-xl p-3.5 border border-gray-800/80">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Scissors className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-200 block">AI Background Remover</span>
                      <span className="text-[11px] text-gray-400 block">Extract clean subject cutout</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={removeBackground}
                    onChange={(e) => setRemoveBackground(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </label>

                {removeBackground && (
                  <div className="pt-3 border-t border-gray-800 space-y-3 animate-fade-in">
                    <span className="text-xs font-semibold text-gray-400 block">Backdrop Style</span>
                    
                    {/* Backdrop Mode Chips */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBgMode('transparent')}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                          bgMode === 'transparent'
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                            : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800'
                        }`}
                      >
                        <div className="w-4 h-4 rounded border border-gray-600 bg-[linear-gradient(45deg,#444_25%,transparent_25%),linear-gradient(-45deg,#444_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#444_75%),linear-gradient(-45deg,transparent_75%,#444_75%)] bg-[size:6px_6px] bg-[position:0_0,0_3px,3px_-3px,-3px_0]" />
                        Transparent PNG
                      </button>

                      <button
                        type="button"
                        onClick={() => setBgMode('color')}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                          bgMode === 'color'
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                            : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800'
                        }`}
                      >
                        <Palette className="w-4 h-4 text-pink-400" />
                        Solid Color
                      </button>

                      <button
                        type="button"
                        onClick={() => setBgMode('blur')}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                          bgMode === 'blur'
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                            : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        Bokeh Blur
                      </button>

                      <button
                        type="button"
                        onClick={() => setBgMode('custom')}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                          bgMode === 'custom'
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                            : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800'
                        }`}
                      >
                        <Layers className="w-4 h-4 text-blue-400" />
                        Custom Image
                      </button>
                    </div>

                    {/* Sub-controls based on mode */}
                    {bgMode === 'color' && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Color Presets</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono text-gray-300 uppercase">{bgColor}</span>
                            <input
                              type="color"
                              value={bgColor}
                              onChange={(e) => setBgColor(e.target.value)}
                              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_PRESETS.map((preset) => (
                            <button
                              key={preset.hex}
                              type="button"
                              onClick={() => setBgColor(preset.hex)}
                              className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                                bgColor.toLowerCase() === preset.hex.toLowerCase()
                                  ? 'border-cyan-400 scale-110 ring-2 ring-cyan-500/40'
                                  : 'border-gray-700 hover:scale-105'
                              }`}
                              style={{ backgroundColor: preset.hex }}
                              title={preset.name}
                            >
                              {bgColor.toLowerCase() === preset.hex.toLowerCase() && (
                                <Check className={`w-3.5 h-3.5 ${preset.hex === '#FFFFFF' || preset.hex === '#F3F4F6' || preset.hex === '#00FF00' ? 'text-black' : 'text-white'}`} />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {bgMode === 'blur' && (
                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Blur Radius</span>
                          <span className="text-cyan-400 font-semibold">{blurRadius}px</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="45"
                          step="1"
                          value={blurRadius}
                          onChange={(e) => setBlurRadius(parseInt(e.target.value))}
                          className="w-full accent-cyan-500 bg-gray-800"
                        />
                      </div>
                    )}

                    {bgMode === 'custom' && (
                      <div className="space-y-2 pt-2">
                        <input
                          type="file"
                          accept="image/*"
                          ref={customBgInputRef}
                          onChange={handleCustomBgChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => customBgInputRef.current?.click()}
                          className="w-full py-2.5 px-3 border border-dashed border-gray-700 hover:border-cyan-500 rounded-xl bg-gray-900/60 text-xs text-gray-300 hover:text-cyan-400 flex items-center justify-center gap-2 transition-all"
                        >
                          <UploadCloud className="w-4 h-4" />
                          {customBgFile ? `Selected: ${customBgFile.name.substring(0, 18)}...` : 'Upload Backdrop Image'}
                        </button>
                        {customBgPreview && (
                          <div className="w-full h-16 rounded-lg overflow-hidden border border-gray-800 relative bg-black">
                            <img src={customBgPreview} alt="Custom Backdrop" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Watermark Removal Toggle */}
              <label className="flex items-center justify-between p-3.5 bg-gray-950/60 rounded-xl border border-gray-800/80 cursor-pointer hover:bg-gray-900 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-200 block">AI Watermark Removal</span>
                    <span className="text-[11px] text-gray-400 block">Erase logos, timestamps & stamps</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={removeWatermark}
                  onChange={(e) => setRemoveWatermark(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
              </label>

              {/* 3. 4K Ultra HD Upscale Toggle */}
              <label className="flex items-center justify-between p-3.5 bg-gray-950/60 rounded-xl border border-gray-800/80 cursor-pointer hover:bg-gray-900 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <span className="text-xs font-black">4K</span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-200 block">4K Ultra HD Upscale</span>
                    <span className="text-[11px] text-gray-400 block">Super-resolution up to 3840px</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={upscaleTo4K}
                  onChange={(e) => setUpscaleTo4K(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
              </label>

              {/* Sliders for Sharpen & Contrast */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium text-gray-300">
                    <span>Edge Sharpening</span>
                    <span className="text-cyan-400">{Math.round(sharpenStrength * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={sharpenStrength}
                    onChange={(e) => setSharpenStrength(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 bg-gray-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium text-gray-300">
                    <span>Contrast & Texture</span>
                    <span className="text-cyan-400">{Math.round(contrastBoost * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={contrastBoost}
                    onChange={(e) => setContrastBoost(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 bg-gray-800"
                  />
                </div>
              </div>

              {/* Process Button */}
              <button
                onClick={handleProcess}
                disabled={isProcessing || (!removeBackground && !removeWatermark && !upscaleTo4K)}
                className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Render Enhanced Output
                  </>
                )}
              </button>

              {statusMsg && (
                <div className="text-xs text-center text-cyan-300 bg-cyan-950/40 p-3 rounded-xl border border-cyan-500/30 flex items-center justify-center gap-2">
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
                  <span>{statusMsg}</span>
                </div>
              )}
            </div>

            {/* Preview & Output Panel (Right) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Photo Preview */}
                <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-4 border border-gray-800 flex flex-col shadow-lg">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Original Input</span>
                  </div>
                  <div className="aspect-square bg-gray-950 rounded-xl overflow-hidden flex items-center justify-center border border-gray-800 relative">
                    {originalUrl && (
                      <img src={originalUrl} alt="Original" className="max-w-full max-h-full object-contain" />
                    )}
                  </div>
                </div>

                {/* Enhanced / Cutout Output Preview */}
                <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-4 border border-gray-800 flex flex-col shadow-lg">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Studio Output
                    </span>
                    {resultDims && (
                      <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                        {resultDims.width} × {resultDims.height}
                      </span>
                    )}
                  </div>

                  <div
                    className={`aspect-square rounded-xl overflow-hidden flex items-center justify-center border border-gray-800 relative ${
                      isTransparentResult
                        ? 'bg-[linear-gradient(45deg,#1f2937_25%,transparent_25%),linear-gradient(-45deg,#1f2937_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f2937_75%),linear-gradient(-45deg,transparent_75%,#1f2937_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] bg-gray-950'
                        : 'bg-gray-950'
                    }`}
                  >
                    {resultUrl ? (
                      <img src={resultUrl} alt="AI Enhanced" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="text-center p-6 text-gray-500 flex flex-col items-center">
                        <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-600 mb-3">
                          <Scissors className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-medium text-gray-400 mb-1">No Output Generated Yet</p>
                        <p className="text-[11px] text-gray-600 max-w-xs">
                          Configure your background removal & enhancement options, then click "Render Enhanced Output".
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Output Action Bar & Download */}
              {resultUrl && (
                <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-100">Clean Image Ready</h4>
                      <p className="text-xs text-gray-400">
                        {isTransparentResult ? 'Transparent Cutout PNG' : 'High Quality Composite PNG'} • {resultDims?.width} × {resultDims?.height}
                      </p>
                    </div>
                  </div>

                  <a
                    href={resultUrl}
                    download={`${isTransparentResult ? 'cutout' : 'enhanced'}_${file.name.replace(/\.[^/.]+$/, '')}.png`}
                    className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-gray-950 font-extrabold py-3 px-8 rounded-xl shadow-lg shadow-green-500/25 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
                  >
                    <Download className="w-5 h-5" />
                    Download PNG
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
