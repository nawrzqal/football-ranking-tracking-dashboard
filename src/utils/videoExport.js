import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const EXPORT_WIDTH = 2800;
const EXPORT_HEIGHT = 1350;
const EXPORT_BITRATE = 20_000_000;

export async function exportAnimation(opts) {
  const {
    svg,
    totalFrames,
    fps = 30,
    width = EXPORT_WIDTH,
    height = EXPORT_HEIGHT,
    filename = 'syrian-league-race.mp4',
    renderFrame,
    onProgress,
  } = opts;

  if (!svg) throw new Error('exportAnimation: missing svg element');
  if (typeof renderFrame !== 'function')
    throw new Error('exportAnimation: renderFrame must be a function');

  if (typeof VideoEncoder === 'undefined') {
    throw new Error(
      'WebCodecs غير مدعوم في هذا المتصفح. استخدم Chrome/Edge أحدث إصدار.'
    );
  }

  const codecCandidates = [
    'avc1.640033', // H.264 High @ Level 5.1 (4K capable)
    'avc1.640028', // H.264 High @ Level 4.0
    'avc1.4d0033', // H.264 Main @ Level 5.1
    'avc1.42E033', // H.264 Baseline @ Level 5.1
  ];
  let codec = null;
  for (const c of codecCandidates) {
    const support = await VideoEncoder.isConfigSupported({
      codec: c,
      width,
      height,
      bitrate: EXPORT_BITRATE,
      framerate: fps,
    });
    if (support.supported) {
      codec = support.config.codec;
      break;
    }
  }
  if (!codec) throw new Error('لا يوجد ترميز H.264 مدعوم في هذا المتصفح.');

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width,
      height,
      frameRate: fps,
    },
    fastStart: 'in-memory',
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      console.error('VideoEncoder error:', e);
    },
  });
  encoder.configure({
    codec,
    width,
    height,
    bitrate: EXPORT_BITRATE,
    framerate: fps,
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const SECONDS_PER_MATCHWEEK = 0.6;
  const stepsPerMW = Math.max(1, Math.round(fps * SECONDS_PER_MATCHWEEK));
  const initialHold = fps;
  const finalHold = fps * 2;

  const totalRenderedFrames =
    initialHold + (totalFrames - 1) * stepsPerMW + finalHold;
  const frameDurationUs = Math.round(1_000_000 / fps);
  let frameIndex = 0;
  let lastReportedProgress = -1;

  const reportProgress = () => {
    const p = frameIndex / totalRenderedFrames;
    const bucket = Math.floor(p * 100);
    if (bucket !== lastReportedProgress) {
      lastReportedProgress = bucket;
      onProgress?.(p);
    }
  };

  const drawAndEncode = async (frac) => {
    await renderFrame(frac);
    await nextFrame();
    await nextFrame();
    await nextFrame();

    const img = await svgToImage(svg, width, height);
    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const timestamp = frameIndex * frameDurationUs;
    // Keyframe every ~1s and on the very first frame
    const keyFrame = frameIndex % fps === 0;
    const videoFrame = new VideoFrame(canvas, {
      timestamp,
      duration: frameDurationUs,
    });
    encoder.encode(videoFrame, { keyFrame });
    videoFrame.close();
    frameIndex++;
    reportProgress();

    // Backpressure: don't let the encoder queue balloon
    if (encoder.encodeQueueSize > 8) {
      while (encoder.encodeQueueSize > 4) {
        await waitMs(10);
      }
    }
  };

  try {
    for (let r = 0; r < initialHold; r++) {
      await drawAndEncode(0);
    }
    for (let i = 0; i < totalFrames - 1; i++) {
      for (let r = 0; r < stepsPerMW; r++) {
        const t = r / stepsPerMW;
        await drawAndEncode(i + t);
      }
    }
    for (let r = 0; r < finalHold; r++) {
      await drawAndEncode(totalFrames - 1);
    }

    await encoder.flush();
    encoder.close();
    muxer.finalize();
    onProgress?.(1);

    const { buffer } = muxer.target;
    const blob = new Blob([buffer], { type: 'video/mp4' });
    triggerDownload(blob, filename);
    return blob;
  } catch (err) {
    try {
      encoder.close();
    } catch {
      // already closed
    }
    throw err;
  }
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

async function inlineImages(root) {
  const images = root.querySelectorAll('image');
  await Promise.all(
    Array.from(images).map(async (el) => {
      const href =
        el.getAttribute('href') ||
        el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      if (!href || href.startsWith('data:')) return;
      try {
        const res = await fetch(href);
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        el.setAttribute('href', dataUrl);
      } catch {
        // leave as-is if it fails
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
