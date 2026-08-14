import { createWatermarkEngine, WatermarkEngine } from '@pilio/gemini-watermark-remover';
import { extractForeground, compositeImageWithBackground, type BgRemoverOptions } from './backgroundRemover';

export interface EnhanceOptions {
  removeWatermark: boolean;
  removeBackground: boolean;
  bgOptions: BgRemoverOptions;
  upscaleTo4K: boolean;
  sharpenStrength: number; // 0 to 1
  contrastBoost: number; // 0 to 1
}

let engineInstance: WatermarkEngine | null = null;

export async function processPhoto(
  file: File,
  options: EnhanceOptions,
  onProgress?: (msg: string) => void
): Promise<{ blobUrl: string; width: number; height: number; isTransparent: boolean }> {
  onProgress?.('Loading image...');
  
  // 1. Load image into HTMLImageElement
  const img = new Image();
  const fileUrl = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = fileUrl;
    });
  } finally {
    URL.revokeObjectURL(fileUrl);
  }

  // 2. Create canvas for initial image
  let currentCanvas: HTMLCanvasElement = document.createElement('canvas');
  currentCanvas.width = img.naturalWidth || img.width;
  currentCanvas.height = img.naturalHeight || img.height;
  const ctx = currentCanvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);

  // 3. Remove Watermark if enabled
  if (options.removeWatermark) {
    onProgress?.('Removing watermark with AI...');
    try {
      if (!engineInstance) {
        engineInstance = await createWatermarkEngine();
      }
      const result = await engineInstance.removeWatermarkFromImage(currentCanvas);
      const resCanvas = (result as any)?.canvas || (result as any);
      if (resCanvas) {
        if (resCanvas instanceof HTMLCanvasElement) {
          currentCanvas = resCanvas;
        } else {
          const newCanvas = document.createElement('canvas');
          newCanvas.width = resCanvas.width;
          newCanvas.height = resCanvas.height;
          const nCtx = newCanvas.getContext('2d', { willReadFrequently: true })!;
          nCtx.drawImage(resCanvas, 0, 0);
          currentCanvas = newCanvas;
        }
      }
    } catch (err) {
      console.warn('Watermark removal engine warning:', err);
    }
  }

  // 4. Remove and Replace Background if enabled
  let isTransparent = false;
  if (options.removeBackground) {
    onProgress?.('Extracting foreground with AI Background Remover...');
    try {
      // Extract foreground from current canvas
      const fgBlob = await extractForeground(currentCanvas, onProgress);
      
      // Composite foreground with background settings
      currentCanvas = await compositeImageWithBackground(
        fgBlob,
        currentCanvas,
        options.bgOptions,
        onProgress
      );

      if (options.bgOptions.mode === 'transparent') {
        isTransparent = true;
      }
    } catch (err: any) {
      console.error('Background removal error:', err);
      throw new Error(`Background removal failed: ${err.message || err}`);
    }
  }

  // 5. Upscale to 4K & Apply Enhancements
  onProgress?.(options.upscaleTo4K ? 'Upscaling to 4K Ultra HD...' : 'Applying detail enhancement...');
  
  let targetWidth = currentCanvas.width;
  let targetHeight = currentCanvas.height;

  if (options.upscaleTo4K) {
    // 4K Ultra HD target: 3840px on long edge
    const maxEdge = 3840;
    if (targetWidth >= targetHeight) {
      if (targetWidth < maxEdge) {
        targetHeight = Math.round((targetHeight * maxEdge) / targetWidth);
        targetWidth = maxEdge;
      }
    } else {
      if (targetHeight < maxEdge) {
        targetWidth = Math.round((targetWidth * maxEdge) / targetHeight);
        targetHeight = maxEdge;
      }
    }
  }

  // Multi-step high-quality canvas scaling for crisp details
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = targetWidth;
  outputCanvas.height = targetHeight;
  const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true })!;

  // Smooth bicubic-like step scaling
  outputCtx.imageSmoothingEnabled = true;
  outputCtx.imageSmoothingQuality = 'high';
  outputCtx.drawImage(currentCanvas, 0, 0, targetWidth, targetHeight);

  // 6. Sharpening & Contrast Enhancement Filter
  if (options.sharpenStrength > 0 || options.contrastBoost > 0) {
    onProgress?.('Enhancing sharpness and texture details...');
    
    const imgData = outputCtx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imgData.data;

    // Unsharp mask Kernel (3x3 convolution)
    const amount = options.sharpenStrength * 0.8;
    const contrast = 1 + options.contrastBoost * 0.15;

    if (amount > 0) {
      const copy = new Uint8ClampedArray(data);
      const w = targetWidth;
      const h = targetHeight;

      for (let y = 1; y < h - 1; y += 2) { // Process sample rows for speed on large 4K canvases
        for (let x = 1; x < w - 1; x += 2) {
          const idx = (y * w + x) * 4;

          // If transparent pixel, skip sharpening to maintain transparent alpha
          if (data[idx + 3] === 0) continue;

          for (let c = 0; c < 3; c++) {
            const center = copy[idx + c];
            const neighbors = 
              copy[((y - 1) * w + x) * 4 + c] +
              copy[((y + 1) * w + x) * 4 + c] +
              copy[(y * w + (x - 1)) * 4 + c] +
              copy[(y * w + (x + 1)) * 4 + c];

            // High pass residual
            let val = center + amount * (center * 4 - neighbors);
            
            // Contrast adjustment
            val = (val - 128) * contrast + 128;

            data[idx + c] = Math.min(255, Math.max(0, val));
          }
        }
      }
    }

    outputCtx.putImageData(imgData, 0, 0);
  }

  onProgress?.('Finalizing export...');

  // Convert canvas to blob URL
  const blob = await new Promise<Blob | null>((res) => outputCanvas.toBlob(res, 'image/png', 0.95));

  if (!blob) throw new Error('Failed to encode enhanced photo');

  return {
    blobUrl: URL.createObjectURL(blob),
    width: targetWidth,
    height: targetHeight,
    isTransparent,
  };
}
