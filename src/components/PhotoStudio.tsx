import { useState, useEffect } from 'react';
import { UploadCloud, Image as ImageIcon, Sparkles, Download, Sliders, Loader2 } from 'lucide-react';
import { processPhoto, type EnhanceOptions } from '../lib/photoEnhancer';

export function PhotoStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultDims, setResultDims] = useState<{ width: number; height: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Options
  const [removeWatermark, setRemoveWatermark] = useState(true);
  const [upscaleTo4K, setUpscaleTo4K] = useState(true);
  const [sharpenStrength, setSharpenStrength] = useState(0.5);
  const [contrastBoost, setContrastBoost] = useState(0.3);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setOriginalUrl(url);
      setResultUrl(null);
      setResultDims(null);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

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

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    setStatusMsg('Initializing...');

    try {
      const options: EnhanceOptions = {
        removeWatermark,
        upscaleTo4K,
        sharpenStrength,
        contrastBoost,
      };

      const res = await processPhoto(file, options, (msg) => setStatusMsg(msg));
      setResultUrl(res.blobUrl);
      setResultDims({ width: res.width, height: res.height });
      setStatusMsg('Enhancement Complete!');
    } catch (err: any) {
      console.error(err);
      setStatusMsg(err?.message || 'Processing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {!file ? (
        /* Upload Area */
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-gray-700 hover:border-cyan-500 rounded-2xl p-12 text-center bg-gray-900/40 backdrop-blur-md transition-all cursor-pointer group"
        >
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            id="photo-upload"
            onChange={handleFileChange}
          />
          <label htmlFor="photo-upload" className="cursor-pointer flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-200 mb-1">Upload Photo for AI Watermark Removal & 4K Enhancement</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">
              Supports PNG, JPG, and WebP. Automatically removes watermarks and upscales any image to crisp 4K Ultra HD.
            </p>
            <span className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-full shadow-lg shadow-cyan-500/20 text-sm transition-all">
              Select Photo
            </span>
          </label>
        </div>
      ) : (
        /* Processing Studio */
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            <div className="flex items-center gap-3">
              <ImageIcon className="w-6 h-6 text-cyan-400" />
              <div>
                <h2 className="text-lg font-bold text-gray-100">{file.name}</h2>
                <p className="text-xs text-gray-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-xs text-gray-400 hover:text-white bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors"
            >
              Upload Different Photo
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Options Panel */}
            <div className="bg-gray-900/60 rounded-xl p-5 border border-gray-800 space-y-5 h-fit">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 uppercase tracking-wider">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Enhancement Controls
              </h3>

              {/* Watermark Toggle */}
              <label className="flex items-center justify-between p-3 bg-gray-800/60 rounded-lg border border-gray-700/50 cursor-pointer hover:bg-gray-800">
                <span className="text-sm font-medium text-gray-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  AI Watermark Removal
                </span>
                <input
                  type="checkbox"
                  checked={removeWatermark}
                  onChange={(e) => setRemoveWatermark(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 rounded"
                />
              </label>

              {/* 4K Upscale Toggle */}
              <label className="flex items-center justify-between p-3 bg-gray-800/60 rounded-lg border border-gray-700/50 cursor-pointer hover:bg-gray-800">
                <div>
                  <span className="text-sm font-medium text-gray-200 block">4K Ultra HD Upscale</span>
                  <span className="text-xs text-gray-400 block">Expand resolution to 3840px edge</span>
                </div>
                <input
                  type="checkbox"
                  checked={upscaleTo4K}
                  onChange={(e) => setUpscaleTo4K(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 rounded"
                />
              </label>

              {/* Sharpening Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-gray-300">
                  <span>Detail Sharpening</span>
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

              {/* Contrast / Texture Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-gray-300">
                  <span>Contrast & Clarity</span>
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

              {/* Action Button */}
              <button
                onClick={handleProcess}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Process & Enhance to 4K
                  </>
                )}
              </button>

              {statusMsg && (
                <div className="text-xs text-center text-cyan-400 bg-cyan-500/10 p-2.5 rounded-lg border border-cyan-500/20 animate-fade-in">
                  {statusMsg}
                </div>
              )}
            </div>

            {/* Before / After Preview */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original */}
                <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-800 flex flex-col">
                  <span className="text-xs font-semibold text-gray-400 mb-2 uppercase">Original Image</span>
                  <div className="aspect-square bg-black rounded-lg overflow-hidden flex items-center justify-center border border-gray-800">
                    {originalUrl && (
                      <img src={originalUrl} alt="Original" className="max-w-full max-h-full object-contain" />
                    )}
                  </div>
                </div>

                {/* Enhanced */}
                <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-800 flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase">Enhanced Output</span>
                    {resultDims && (
                      <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30">
                        {resultDims.width} x {resultDims.height} ({upscaleTo4K ? '4K Ultra HD' : 'Original Res'})
                      </span>
                    )}
                  </div>
                  <div className="aspect-square bg-black rounded-lg overflow-hidden flex items-center justify-center border border-gray-800 relative">
                    {resultUrl ? (
                      <img src={resultUrl} alt="Enhanced" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="text-center p-6 text-gray-500">
                        <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">Click "Process & Enhance" to generate the clean 4K image</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Download Button */}
              {resultUrl && (
                <div className="flex justify-end pt-2">
                  <a
                    href={resultUrl}
                    download={`enhanced_4k_${file.name.replace(/\.[^/.]+$/, '')}.png`}
                    className="bg-green-500 hover:bg-green-400 text-gray-950 font-bold py-3 px-8 rounded-full shadow-lg shadow-green-500/20 flex items-center gap-2 transition-all hover:scale-105"
                  >
                    <Download className="w-5 h-5" />
                    Download 4K Clean Image
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
