import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Native SVG viewBox size — 1:1 pixel mapping, no upscale needed
const EXPORT_WIDTH = 2800;
const EXPORT_HEIGHT = 1350;
// 20 Mbps VP9 — high quality, manageable for browser MediaRecorder
const EXPORT_BITRATE = 20_000_000;

// Loaded once, reused across exports
let _ffmpeg = null;
async function getFFmpeg() {
  if (_ffmpeg) return _ffmpeg;
  const ff = new FFmpeg();
  const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ff.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  _ffmpeg = ff;
  return ff;
}

async function transcodeToMov(webmBlob, onProgress) {
  const ff = await getFFmpeg();
  ff.on('progress', ({ progress }) => onProgress?.(progress));
  await ff.writeFile('input.webm', await fetchFile(webmBlob));
  await ff.exec([
    '-i', 'input.webm',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-an',
    'output.mov',
  ]);
  const data = await ff.readFile('output.mov');
  await ff.deleteFile('input.webm');
  await ff.deleteFile('output.mov');
  return new Blob([data.buffer], { type: 'video/quicktime' });
}

export async function exportAnimation(opts) {
  const {
    svg,
    totalFrames,
    fps = 30,
    width = EXPORT_WIDTH,
    height = EXPORT_HEIGHT,
    filename = '4k-syrian-league-race.mov',
    renderFrame,
    onProgress,
  } = opts;

  if (!svg) throw new Error('exportAnimation: missing svg element');
  if (typeof renderFrame !== 'function')
    throw new Error('exportAnimation: renderFrame must be a function');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(fps);
  const mime = pickMime();
  const recorderOpts = {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: EXPORT_BITRATE,
  };
  const recorder = new MediaRecorder(stream, recorderOpts);
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise((resolve) => (recorder.onstop = resolve));
  recorder.start();

  // Wait for MediaRecorder to fully initialise before writing frames
  await waitMs(200);

  // Time budget per matchweek transition (seconds). Lower = faster playback.
  const SECONDS_PER_MATCHWEEK = 0.6;
  const stepsPerMW = Math.max(1, Math.round(fps * SECONDS_PER_MATCHWEEK));
  const initialHold = fps; // 1s pause on the very first frame
  const finalHold = fps * 2; // 2s pause on the last frame

  const captureFrame = async (frac) => {
    await renderFrame(frac);
    // Allow React to commit the DOM update before rasterising
    await nextFrame();
    await nextFrame();
    await nextFrame();
    const img = await svgToImage(svg, width, height);
    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    await waitMs(1000 / fps);
  };

  try {
    // Hold initial frame
    for (let r = 0; r < initialHold; r++) {
      await captureFrame(0);
    }

    // Smooth transitions between matchweeks
    for (let i = 0; i < totalFrames - 1; i++) {
      for (let r = 0; r < stepsPerMW; r++) {
        const t = r / stepsPerMW;
        await captureFrame(i + t);
      }
      onProgress?.((i + 1) / totalFrames);
    }

    // Final exact frame + hold
    for (let r = 0; r < finalHold; r++) {
      await captureFrame(totalFrames - 1);
    }
    onProgress?.(1);
  } finally {
    recorder.stop();
  }

  await done;
  const webmBlob = new Blob(chunks, { type: chunks[0]?.type || 'video/webm' });

  onProgress?.(0); // reset bar while transcoding
  const movBlob = await transcodeToMov(webmBlob, (p) => onProgress?.(p));
  triggerDownload(movBlob, filename);
  return movBlob;
}

function pickMime() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return null;
}

function nextFrame() {
  return new Promise((res) => requestAnimationFrame(() => res()));
}

function waitMs(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function svgToImage(svg, width, height) {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  await inlineImages(clone);

  const xml = new XMLSerializer().serializeToString(clone);
  const svg64 = btoa(unescape(encodeURIComponent(xml)));
  const dataUrl = `data:image/svg+xml;base64,${svg64}`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}

/**
 * Convert <image href="..."> inside the cloned SVG to base64 data URLs so the
 * rasterizer doesn't require network fetches (which would taint the canvas).
 */
async function inlineImages(root) {
  const images = root.querySelectorAll('image');
  await Promise.all(
    Array.from(images).map(async (el) => {
      const href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      if (!href || href.startsWith('data:')) return;
      try {
        const res = await fetch(href);
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        el.setAttribute('href', dataUrl);
      } catch {
        // leave as-is if it fails; rasterization may still succeed if same-origin
      }
    })
  );
}

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
