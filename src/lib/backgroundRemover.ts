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
 * Converts any image input source (HTMLCanvasElement, OffscreenCanvas, HTMLImageElement, ImageBitmap, ImageData, Blob, File, URL string)
 * into a standard HTMLCanvasElement.
 */
export async function imageSourceToCanvas(
  imageSource: Blob | File | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageData | ImageBitmap | string | any
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');

  if (typeof HTMLCanvasElement !== 'undefined' && imageSource instanceof HTMLCanvasElement) {
    canvas.width = imageSource.width;
    canvas.height = imageSource.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(imageSource, 0, 0);
    return canvas;
  }

  if (typeof OffscreenCanvas !== 'undefined' && imageSource instanceof OffscreenCanvas) {
    canvas.width = imageSource.width;
    canvas.height = imageSource.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(imageSource, 0, 0);
    return canvas;
  }

  if (typeof ImageBitmap !== 'undefined' && imageSource instanceof ImageBitmap) {
    canvas.width = imageSource.width;
    canvas.height = imageSource.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(imageSource, 0, 0);
    return canvas;
  }

  if (typeof ImageData !== 'undefined' && imageSource instanceof ImageData) {
    canvas.width = imageSource.width;
    canvas.height = imageSource.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.putImageData(imageSource, 0, 0);
    return canvas;
  }

  if (typeof HTMLImageElement !== 'undefined' && imageSource instanceof HTMLImageElement) {
    const width = imageSource.naturalWidth || imageSource.width;
    const height = imageSource.naturalHeight || imageSource.height;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(imageSource, 0, 0);
    return canvas;
  }

  if (typeof imageSource === 'string') {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image from source URL'));
      img.src = imageSource;
    });
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  if (typeof Blob !== 'undefined' && imageSource instanceof Blob) {
    let url: string | null = null;
    try {
      url = URL.createObjectURL(imageSource);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image from Blob'));
        img.src = url!;
      });
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      return canvas;
    } finally {
      if (url) {
        URL.revokeObjectURL(url);
      }
    }
  }

  // Check if imageSource has a nested canvas property (e.g. from sdk wrappers)
  if (imageSource && typeof imageSource === 'object' && imageSource.canvas) {
    return imageSourceToCanvas(imageSource.canvas);
  }

  throw new Error(`Unsupported image source type for background removal: ${Object.prototype.toString.call(imageSource)}`);
}

/**
 * Removes background using client-side AI (@xenova/transformers + Xenova/modnet)
 */
export async function extractForeground(
  imageSource: Blob | File | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageData | ImageBitmap | string | any,
  onProgress?: (status: string) => void
): Promise<Blob> {
  try {
    const { model, processor } = await getModelAndProcessor(onProgress);

    onProgress?.('Preparing image for AI analysis...');

    const originalCanvas = await imageSourceToCanvas(imageSource);
    const width = originalCanvas.width;
    const height = originalCanvas.height;

    const oCtx = originalCanvas.getContext('2d', { willReadFrequently: true })!;
    const originalImageData = oCtx.getImageData(0, 0, width, height);

    onProgress?.('Processing image with AI...');
    // Create RawImage directly from pixel data for maximum speed and reliability
    const rawImage = new RawImage(originalImageData.data, width, height, 4);

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
  baseCanvasOrImage: HTMLCanvasElement | HTMLImageElement | OffscreenCanvas | any,
  options: BgRemoverOptions,
  onProgress?: (msg: string) => void
): Promise<HTMLCanvasElement> {
  onProgress?.('Compositing backdrop...');

  if (!(foregroundBlob instanceof Blob)) {
    throw new Error('Invalid foreground blob provided for background compositing');
  }

  // Load foreground image safely
  const fgImg = new Image();
  const fgUrl = URL.createObjectURL(foregroundBlob);
  try {
    await new Promise<void>((resolve, reject) => {
      fgImg.onload = () => resolve();
      fgImg.onerror = () => reject(new Error('Failed to load foreground layer'));
      fgImg.src = fgUrl;
    });
  } finally {
    URL.revokeObjectURL(fgUrl);
  }

  const width = fgImg.naturalWidth || (baseCanvasOrImage as any)?.width || 1000;
  const height = fgImg.naturalHeight || (baseCanvasOrImage as any)?.height || 1000;

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
    try {
      bgCtx.drawImage(baseCanvasOrImage as CanvasImageSource, -20, -20, width + 40, height + 40);
    } catch {
      // If drawImage fails on baseCanvasOrImage directly, convert to canvas first
      const convertedBase = await imageSourceToCanvas(baseCanvasOrImage);
      bgCtx.drawImage(convertedBase, -20, -20, width + 40, height + 40);
    }
    
    ctx.drawImage(bgCanvas, 0, 0, width, height);
    ctx.drawImage(fgImg, 0, 0, width, height);
  } else if (options.mode === 'custom' && options.customBgFile && options.customBgFile instanceof Blob) {
    const customImg = new Image();
    const customUrl = URL.createObjectURL(options.customBgFile);
    try {
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
    } finally {
      URL.revokeObjectURL(customUrl);
    }
    ctx.drawImage(fgImg, 0, 0, width, height);
  } else {
    ctx.drawImage(fgImg, 0, 0, width, height);
  }

  return canvas;
}
