/**
 * Record an animation to a WebM video via MediaRecorder + a hidden canvas.
 *
 * Fully isolated: the caller provides a `renderFrame(frameIndex)` async function
 * that mutates external state so that the next time the canvas is repainted
 * (via `drawSvgToCanvas`) the new frame is reflected. The exporter handles:
 *   - SVG → canvas rasterization at 30fps
 *   - MediaRecorder lifecycle
 *   - progress reporting
 *   - download trigger
 *
 * @param {{
 *   svg: SVGSVGElement,
 *   totalFrames: number,
 *   fps?: number,
 *   width?: number,
 *   height?: number,
 *   filename?: string,
 *   renderFrame: (i: number) => Promise<void> | void,
 *   onProgress?: (ratio: number) => void,
 * }} opts
 */
// Native SVG viewBox size — 1:1 pixel mapping, no upscale needed
const EXPORT_WIDTH = 2800;
const EXPORT_HEIGHT = 1350;
// 20 Mbps VP9 — high quality, manageable for browser MediaRecorder
const EXPORT_BITRATE = 20_000_000;

export async function exportAnimation(opts) {
  const {
    svg,
    totalFrames,
    fps = 30,
    width = EXPORT_WIDTH,
    height = EXPORT_HEIGHT,
    filename = '4k-syrian-league-race.webm',
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

  const framesPerStep = Math.max(1, Math.round(fps * 0.6));

  try {
    for (let i = 0; i < totalFrames; i++) {
      await renderFrame(i);
      // Wait several animation frames so React can commit the DOM update before
      // we rasterize the SVG — a single rAF is not enough for batched re-renders.
      await nextFrame();
      await nextFrame();
      await nextFrame();
      const img = await svgToImage(svg, width, height);
      // Hold each step longer on the first frame so it's clearly visible
      const hold = i === 0 ? fps : framesPerStep;
      for (let r = 0; r < hold; r++) {
        ctx.fillStyle = '#f9f9f9';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        await waitMs(1000 / fps);
      }
      onProgress?.((i + 1) / totalFrames);
    }
    // hold the final frame for ~2s
    const hold = fps * 2;
    for (let r = 0; r < hold; r++) {
      await waitMs(1000 / fps);
    }
  } finally {
    recorder.stop();
  }

  await done;
  const blob = new Blob(chunks, { type: chunks[0]?.type || 'video/webm' });
  triggerDownload(blob, filename);
  return blob;
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
