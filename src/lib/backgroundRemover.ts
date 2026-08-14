import { removeBackground as imglyRemoveBackground, type Config } from '@imgly/background-removal';

export type BgMode = 'transparent' | 'color' | 'blur' | 'custom';

export interface BgRemoverOptions {
  mode: BgMode;
  color?: string; // e.g. '#ffffff', '#000000', '#3b82f6'
  blurRadius?: number; // e.g. 15
  customBgFile?: File | null;
}

/**
 * Removes background using client-side AI (@imgly/background-removal)
 */
export async function extractForeground(
  imageSource: Blob | File | HTMLImageElement | HTMLCanvasElement | string,
  onProgress?: (status: string) => void
): Promise<Blob> {
  const config: Config = {
    publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/',
    progress: (key: string, current: number, total: number) => {
      if (total > 0) {
        const pct = Math.round((current / total) * 100);
        onProgress?.(`AI Background Removal: ${key} (${pct}%)`);
      } else {
        onProgress?.(`AI Background Removal: ${key}...`);
      }
    },
    output: {
      format: 'image/png',
      quality: 1.0,
    },
  };

  try {
    const blob = await imglyRemoveBackground(imageSource, config);
    return blob;
  } catch (error: any) {
    console.error('Error during AI background removal:', error);
    throw new Error(error?.message || 'Failed to remove background from image');
  }
}

/**
 * Composites the transparent foreground onto the chosen background mode
 */
export async function compositeImageWithBackground(
  foregroundBlob: Blob,
  baseCanvasOrImage: HTMLCanvasElement | HTMLImageElement,
  options: BgRemoverOptions,
  onProgress?: (msg: string) => void
): Promise<HTMLCanvasElement> {
  onProgress?.('Compositing background...');

  // Load foreground image
  const fgImg = new Image();
  const fgUrl = URL.createObjectURL(foregroundBlob);
  await new Promise<void>((resolve, reject) => {
    fgImg.onload = () => resolve();
    fgImg.onerror = () => reject(new Error('Failed to load foreground layer'));
    fgImg.src = fgUrl;
  });

  const width = fgImg.naturalWidth || baseCanvasOrImage.width;
  const height = fgImg.naturalHeight || baseCanvasOrImage.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Apply Background according to mode
  if (options.mode === 'transparent') {
    // Canvas is clear by default
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(fgImg, 0, 0, width, height);
  } else if (options.mode === 'color') {
    // Fill with solid color or gradient
    ctx.fillStyle = options.color || '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(fgImg, 0, 0, width, height);
  } else if (options.mode === 'blur') {
    // Blur the original background image
    const blurAmount = options.blurRadius || 20;
    
    // Create temporary canvas for blurred background
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = width;
    bgCanvas.height = height;
    const bgCtx = bgCanvas.getContext('2d')!;
    
    // Scale up slightly to avoid edge bleed during blur
    bgCtx.filter = `blur(${blurAmount}px)`;
    bgCtx.drawImage(baseCanvasOrImage, -20, -20, width + 40, height + 40);
    
    // Draw blurred background then foreground on top
    ctx.drawImage(bgCanvas, 0, 0, width, height);
    ctx.drawImage(fgImg, 0, 0, width, height);
  } else if (options.mode === 'custom' && options.customBgFile) {
    // Load custom backdrop image
    const customImg = new Image();
    const customUrl = URL.createObjectURL(options.customBgFile);
    await new Promise<void>((resolve, reject) => {
      customImg.onload = () => resolve();
      customImg.onerror = () => reject(new Error('Failed to load custom background'));
      customImg.src = customUrl;
    });

    // Draw custom background with "cover" aspect ratio
    const bgRatio = customImg.naturalWidth / customImg.naturalHeight;
    const canvasRatio = width / height;
    let sx = 0, sy = 0, sWidth = customImg.naturalWidth, sHeight = customImg.naturalHeight;

    if (bgRatio > canvasRatio) {
      sWidth = customImg.naturalHeight * canvasRatio;
      sx = (customImg.naturalWidth - sWidth) / 2;
    } else {
      sHeight = customImg.naturalWidth / canvasRatio;
      sy = (customImg.naturalHeight - sHeight) / 2;
    }

    ctx.drawImage(customImg, sx, sy, sWidth, sHeight, 0, 0, width, height);
    URL.revokeObjectURL(customUrl);
    ctx.drawImage(fgImg, 0, 0, width, height);
  } else {
    // Fallback: just transparent
    ctx.drawImage(fgImg, 0, 0, width, height);
  }

  URL.revokeObjectURL(fgUrl);
  return canvas;
}
