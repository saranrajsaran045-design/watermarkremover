import { pipeline, env, RawImage } from '@xenova/transformers';

export type BgMode = 'transparent' | 'color' | 'blur' | 'custom';

export interface BgRemoverOptions {
  mode: BgMode;
  color?: string; // e.g. '#ffffff', '#000000', '#3b82f6'
  blurRadius?: number; // e.g. 15
  customBgFile?: File | null;
}

// Configure Transformers.js environment for browser client execution
env.allowLocalModels = false;
env.useBrowserCache = true;

let segmenterPromise: Promise<any> | null = null;

async function getSegmenter(onProgress?: (status: string) => void) {
  if (!segmenterPromise) {
    onProgress?.('Loading AI background removal model (BRIA RMBG-1.4)...');
    segmenterPromise = pipeline('image-segmentation', 'briaai/RMBG-1.4', {
      progress_callback: (p: any) => {
        if (p.status === 'progress' && p.total) {
          const pct = Math.round((p.loaded / p.total) * 100);
          onProgress?.(`Downloading AI model: ${p.file || 'weights'} (${pct}%)`);
        } else if (p.status === 'initiate') {
          onProgress?.(`Initializing ${p.file || 'model'}...`);
        } else if (p.status === 'ready') {
          onProgress?.('AI Model Ready!');
        }
      },
    });
  }
  return segmenterPromise;
}

/**
 * Removes background using client-side AI (@xenova/transformers + BRIA RMBG-1.4)
 */
export async function extractForeground(
  imageSource: Blob | File | HTMLImageElement | HTMLCanvasElement | string,
  onProgress?: (status: string) => void
): Promise<Blob> {
  try {
    const segmenter = await getSegmenter(onProgress);

    onProgress?.('Preparing image for AI analysis...');

    let srcUrl: string;
    let shouldRevoke = false;
    let originalCanvas: HTMLCanvasElement;

    if (imageSource instanceof HTMLCanvasElement) {
      originalCanvas = imageSource;
      srcUrl = originalCanvas.toDataURL('image/png');
    } else if (imageSource instanceof HTMLImageElement) {
      originalCanvas = document.createElement('canvas');
      originalCanvas.width = imageSource.naturalWidth || imageSource.width;
      originalCanvas.height = imageSource.naturalHeight || imageSource.height;
      const oCtx = originalCanvas.getContext('2d', { willReadFrequently: true })!;
      oCtx.drawImage(imageSource, 0, 0);
      srcUrl = imageSource.src;
    } else if (typeof imageSource === 'string') {
      srcUrl = imageSource;
      originalCanvas = document.createElement('canvas');
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image for background removal'));
        img.src = srcUrl;
      });
      originalCanvas.width = img.naturalWidth;
      originalCanvas.height = img.naturalHeight;
      const oCtx = originalCanvas.getContext('2d', { willReadFrequently: true })!;
      oCtx.drawImage(img, 0, 0);
    } else {
      srcUrl = URL.createObjectURL(imageSource);
      shouldRevoke = true;
      originalCanvas = document.createElement('canvas');
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image for background removal'));
        img.src = srcUrl;
      });
      originalCanvas.width = img.naturalWidth;
      originalCanvas.height = img.naturalHeight;
      const oCtx = originalCanvas.getContext('2d', { willReadFrequently: true })!;
      oCtx.drawImage(img, 0, 0);
    }

    const width = originalCanvas.width;
    const height = originalCanvas.height;

    onProgress?.('Running AI segmentation...');
    const rawImage = await RawImage.fromURL(srcUrl);
    if (shouldRevoke) {
      URL.revokeObjectURL(srcUrl);
    }

    // Run inference
    const output = await segmenter(rawImage);
    const maskRaw = Array.isArray(output) ? output[0]?.mask || output[0] : output?.mask || output;

    if (!maskRaw) {
      throw new Error('AI Model did not return a valid segmentation mask');
    }

    onProgress?.('Applying alpha transparency mask...');

    // Resize mask to match original canvas dimensions
    const mask = await maskRaw.resize(width, height);
    const maskData = mask.data;

    // Create transparent cutout canvas
    const cutoutCanvas = document.createElement('canvas');
    cutoutCanvas.width = width;
    cutoutCanvas.height = height;
    const ctx = cutoutCanvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(originalCanvas, 0, 0);

    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    // Apply alpha mask to each pixel
    for (let i = 0; i < pixels.length; i += 4) {
      const maskIdx = i / 4;
      pixels[i + 3] = maskData[maskIdx] ?? 255;
    }

    ctx.putImageData(imgData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => cutoutCanvas.toBlob(resolve, 'image/png', 1.0));
    if (!blob) throw new Error('Failed to encode transparent cutout');

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
  onProgress?.('Compositing backdrop...');

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
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(fgImg, 0, 0, width, height);
  } else if (options.mode === 'color') {
    ctx.fillStyle = options.color || '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(fgImg, 0, 0, width, height);
  } else if (options.mode === 'blur') {
    const blurAmount = options.blurRadius || 20;
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = width;
    bgCanvas.height = height;
    const bgCtx = bgCanvas.getContext('2d')!;
    
    bgCtx.filter = `blur(${blurAmount}px)`;
    bgCtx.drawImage(baseCanvasOrImage, -20, -20, width + 40, height + 40);
    
    ctx.drawImage(bgCanvas, 0, 0, width, height);
    ctx.drawImage(fgImg, 0, 0, width, height);
  } else if (options.mode === 'custom' && options.customBgFile) {
    const customImg = new Image();
    const customUrl = URL.createObjectURL(options.customBgFile);
    await new Promise<void>((resolve, reject) => {
      customImg.onload = () => resolve();
      customImg.onerror = () => reject(new Error('Failed to load custom background'));
      customImg.src = customUrl;
    });

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
    ctx.drawImage(fgImg, 0, 0, width, height);
  }

  URL.revokeObjectURL(fgUrl);
  return canvas;
}
