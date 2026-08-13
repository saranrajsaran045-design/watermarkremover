import { createWatermarkEngine, WatermarkEngine } from '@pilio/gemini-watermark-remover';

export class VideoProcessor {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private isProcessing = false;
  private onProgress: (progress: number) => void;
  private onComplete: (blobUrl: string) => void;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: BlobPart[] = [];
  private animationFrameId: number | null = null;
  private engine: WatermarkEngine | null = null;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D | null;
  
  constructor(
    file: File,
    canvasElement: HTMLCanvasElement,
    onProgress: (progress: number) => void,
    onComplete: (blobUrl: string) => void
  ) {
    this.video = document.createElement('video');
    this.video.src = URL.createObjectURL(file);
    this.video.muted = true;
    this.video.playsInline = true;
    
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    
    this.onProgress = onProgress;
    this.onComplete = onComplete;
  }

  public async start() {
    this.isProcessing = true;
    this.recordedChunks = [];
    
    // Initialize the official AI engine
    if (!this.engine) {
      this.engine = await createWatermarkEngine();
    }
    
    await new Promise<void>((resolve) => {
      this.video.onloadedmetadata = () => {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.offscreenCanvas.width = this.video.videoWidth;
        this.offscreenCanvas.height = this.video.videoHeight;
        resolve();
      };
    });

    const stream = this.canvas.captureStream(30);
    
    let options = { mimeType: 'video/webm; codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm' };
    }

    this.mediaRecorder = new MediaRecorder(stream, options);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };
    
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      this.onComplete(url);
    };

    this.mediaRecorder.start();
    this.video.play();
    
    this.processLoop();
  }

  private processLoop = async () => {
    if (!this.isProcessing || this.video.paused || this.video.ended) {
      if (this.video.ended) {
        this.stop();
      }
      return;
    }

    if (this.ctx && this.offscreenCtx && this.engine) {
      // Draw video frame to offscreen canvas
      this.offscreenCtx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      
      try {
        // Pass the offscreen canvas to the SDK engine for true AI removal
        const result = await this.engine.removeWatermarkFromImage(this.offscreenCanvas);
        
        // Draw the AI-cleaned result to our main display canvas
        this.ctx.drawImage(result as any, 0, 0);
      } catch (err) {
        // Fallback to original if engine throws (e.g. during rapid seeking)
        this.ctx.drawImage(this.offscreenCanvas, 0, 0);
      }
    }

    // Calculate progress
    if (this.video.duration) {
      const p = Math.round((this.video.currentTime / this.video.duration) * 100);
      this.onProgress(p);
    }

    // Using requestAnimationFrame to keep video sync, but awaiting process first
    this.animationFrameId = requestAnimationFrame(() => {
      this.processLoop();
    });
  };

  public stop() {
    this.isProcessing = false;
    this.video.pause();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }
}
