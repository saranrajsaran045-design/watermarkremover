import { AutoModel, AutoProcessor, RawImage, env } from '@xenova/transformers';

export type BgMode = 'transparent' | 'color' | 'blur' | 'custom';

export interface BgRemoverOptions {
  mode: BgMode;
  color?: string; // e.g. '#ffffff', '#000000', '#3b82f6'
  blurRadius?: number; // e.g. 15
  customBgFile?: File | null;
}

// Configure Transformers.js environment for in-browser execution
env.allowLocalModels = false;
env.useBrowserCache = true;

let modelPromise: Promise<any> | null = null;
let processorPromise: Promise<any> | null = null;

async function getModelAndProcessor(onProgress?: (status: string) => void) {
  if (!modelPromise || !processorPromise) {
    onProgress?.('Loading AI background removal model (MODNet)...');

    const progressCallback = (p: any) => {
      if (p.status === 'progress' && p.total) {
        const pct = Math.round((p.loaded / p.total) * 100);
        onProgress?.(`Downloading AI model: ${p.file || 'weights'} (${pct}%)`);
      } else if (p.status === 'initiate') {
        onProgress?.(`Initializing ${p.file || 'model'}...`);
      } else if (p.status === 'ready') {
        onProgress?.('AI Model Ready!');
      }
    };

    modelPromise = AutoModel.from_pretrained('Xenova/modnet', {
      progress_callback: progressCallback,
    });

    processorPromise = AutoProcessor.from_pretrained('Xenova/modnet', {
      progress_callback: progressCallback,
    });
  }

  const [model, processor] = await Promise.all([modelPromise, processorPromise]);
  return { model, processor };
}

/**
 * Removes background using client-side AI (@xenova/transformers + Xenova/modnet)
 */
export async function extractForeground(
  imageSource: Blob | File | HTMLImageElement | HTMLCanvasElement | string,
  onProgress?: (status: string) => void
): Promise<Blob> {
  try {
    const { model, processor } = await getModelAndProcessor(onProgress);

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

    onProgress?.('Processing image with AI...');
    const rawImage = await RawImage.fromURL(srcUrl);
    if (shouldRevoke) {
      URL.revokeObjectURL(srcUrl);
    }

    // Run AutoProcessor and AutoModel
    const { pixel_values } = await processor(rawImage);
    const { output } = await model({ input: pixel_values });

    onProgress?.('Applying alpha transparency mask...');

    // Convert output tensor to RawImage mask and resize
    const maskTensor = output[0].mul(255).to('uint8');
    const maskRaw = await RawImage.fromTensor(maskTensor);
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
    const maskChannels = mask.channels || 1;
    for (let i = 0; i < pixels.length; i += 4) {
      const pixelIdx = i / 4;
      const maskIdx = pixelIdx * maskChannels;
      const alphaVal = maskData[maskIdx] ?? 255;
      pixels[i + 3] = alphaVal;
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
