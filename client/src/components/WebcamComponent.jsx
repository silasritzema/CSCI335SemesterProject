import { useCallback, useEffect, useRef, useState } from 'react';

/** Match installed @mediapipe/tasks-vision for WASM URL. */
const MEDIAPIPE_TASKS_VERSION = '0.10.34';

/** CSS filter presets applied to the live video (GPU-friendly). */
const WEBCAM_FILTERS = {
  none: 'none',
  grayscale: 'grayscale(1)',
  sepia: 'sepia(0.85)',
  warm: 'sepia(0.25) saturate(1.15) brightness(1.06)',
  cool: 'hue-rotate(165deg) saturate(1.1) contrast(1.05)',
  vintage: 'sepia(0.45) contrast(1.08) brightness(0.92) saturate(0.75)',
  invert: 'invert(1)',
  noir: 'grayscale(1) contrast(1.25) brightness(0.88)',
  soft: 'blur(1.2px) contrast(0.95) saturate(0.9)',
};

/**
 * Mask image search order. Put a transparent PNG at `public/masks/face-mask.png`
 * (square-ish, face forward) to use your own artwork—you must have rights to that image.
 * We cannot ship celebrity photos in the repo.
 */
const MASK_PATHS = ['/masks/face-mask.png', '/masks/rapper.svg'];

/** MediaPipe Face Mesh–compatible indices (person’s left / right eyes). */
const LM_L_EYE_OUTER = 33;
const LM_R_EYE_OUTER = 263;

/**
 * Draws a 2D mask image aligned to eyes (mirrored preview coords).
 * This is a stylized overlay, not a neural “deepfake” face swap.
 */
function drawRapperMask(ctx, landmarks, vw, vh, img) {
  const lm = landmarks;
  if (!lm[LM_L_EYE_OUTER] || !lm[LM_R_EYE_OUTER]) return;

  const mx = (x) => (1 - x) * vw;
  const my = (y) => y * vh;

  const exL = mx(lm[LM_L_EYE_OUTER].x);
  const eyL = my(lm[LM_L_EYE_OUTER].y);
  const exR = mx(lm[LM_R_EYE_OUTER].x);
  const eyR = my(lm[LM_R_EYE_OUTER].y);

  const cx = (exL + exR) / 2;
  const cy = (eyL + eyR) / 2;
  const eyeDist = Math.hypot(exR - exL, eyR - eyL);
  if (eyeDist < 8) return;

  let angle = Math.atan2(eyR - eyL, exR - exL);
  // Keep mask upright: mirrored eye vectors can resolve to +/- PI (flipped).
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;
  const w = eyeDist * 2.85;
  const h = w * (img.naturalHeight / img.naturalWidth);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.translate(0, -h * 0.06);
  ctx.globalAlpha = 0.94;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.globalAlpha = 1;
  ctx.restore();
}

export default function WebcamComponent() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const maskImgRef = useRef(null);
  const rafRef = useRef(0);
  const streamRef = useRef(null);
  /** MediaPipe requires strictly increasing timestamps per stream. */
  const lastVideoFrameTsRef = useRef(0);

  const [isOn, setIsOn] = useState(false);
  const [error, setError] = useState(null);
  const [filterId, setFilterId] = useState('none');
  /** 'none' = plain video; 'rapper' = canvas + tracked mask (not a real identity swap). */
  const [faceMode, setFaceMode] = useState('none');
  const [landmarkerLoading, setLandmarkerLoading] = useState(false);
  const [landmarkerError, setLandmarkerError] = useState(null);

  const startWebcam = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsOn(true);
    } catch (err) {
      setError(err.message || 'Failed to access webcam');
      setIsOn(false);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsOn(false);
  };

  useEffect(() => {
    let cancelled = false;
    let i = 0;
    const tryLoad = () => {
      if (cancelled || i >= MASK_PATHS.length) return;
      const img = new Image();
      img.onload = () => {
        if (!cancelled) maskImgRef.current = img;
      };
      img.onerror = () => {
        i += 1;
        tryLoad();
      };
      img.src = MASK_PATHS[i];
    };
    tryLoad();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isOn || faceMode !== 'rapper') {
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {
          /* ignore */
        }
        landmarkerRef.current = null;
      }
      queueMicrotask(() => {
        setLandmarkerLoading(false);
        setLandmarkerError(null);
      });
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      setLandmarkerLoading(true);
      setLandmarkerError(null);
    });

    (async () => {
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const wasm = await FilesetResolver.forVisionTasks(
          `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VERSION}/wasm`,
        );
        const modelUrl =
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

        const tryCreate = async (delegate) =>
          FaceLandmarker.createFromOptions(wasm, {
            baseOptions: { modelAssetPath: modelUrl, delegate },
            runningMode: 'VIDEO',
            numFaces: 1,
          });

        let lm;
        try {
          lm = await tryCreate('GPU');
        } catch {
          lm = await tryCreate('CPU');
        }

        if (cancelled) {
          lm.close();
          return;
        }
        landmarkerRef.current = lm;
      } catch (e) {
        if (!cancelled) {
          setLandmarkerError(e?.message || 'Could not load face tracking');
        }
      } finally {
        if (!cancelled) setLandmarkerLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {
          /* ignore */
        }
        landmarkerRef.current = null;
      }
    };
  }, [isOn, faceMode]);

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isOn || faceMode !== 'rapper') return;

    if (video.readyState < 2) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) return;

    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    const f = WEBCAM_FILTERS[filterId] ?? WEBCAM_FILTERS.none;
    ctx.filter = f;
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-vw, 0);
    ctx.drawImage(video, 0, 0, vw, vh);
    ctx.restore();
    ctx.filter = 'none';

    const lm = landmarkerRef.current;
    const img = maskImgRef.current;
    if (lm && img?.complete && img.naturalWidth > 0) {
      try {
        let ts = performance.now();
        if (ts <= lastVideoFrameTsRef.current) {
          ts = lastVideoFrameTsRef.current + 0.001;
        }
        lastVideoFrameTsRef.current = ts;
        const results = lm.detectForVideo(video, ts);
        const landmarks = results.faceLandmarks?.[0];
        if (landmarks) {
          drawRapperMask(ctx, landmarks, vw, vh, img);
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[FaceLandmarker]', e);
        }
      }
    }
  }, [isOn, faceMode, filterId]);

  useEffect(() => {
    if (!isOn || faceMode !== 'rapper') {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      return;
    }

    const tick = () => {
      drawFrame();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [isOn, faceMode, drawFrame]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="relative w-80 overflow-hidden rounded-lg border border-[#3f3f3f] bg-[#1a1a1a] p-3">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[#727272]" />
      <div className="mb-2 flex items-center justify-between border-b border-[#4a4a4a] pb-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#dddddd]">Webcam</h3>
        <button
          type="button"
          className={`btn btn-xs h-7 min-h-7 rounded border-0 px-3 text-[10px] font-semibold uppercase tracking-wide ${
            isOn
              ? 'bg-[#b6424a] text-[#ffe4e7]'
              : 'bg-[#616161] text-[#f3f3f3]'
          }`}
          onClick={isOn ? stopWebcam : startWebcam}
        >
          {isOn ? 'Power Off' : 'Power On'}
        </button>
      </div>

      {error && (
        <div className="alert border-none bg-[#5b1f24]/90 py-2 text-[#ffd8dc]">
          <span className="text-xs">{error}</span>
        </div>
      )}

      <label className="mb-2 flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b1b1b1]">Filter</span>
        <select
          className="select select-sm h-8 min-h-8 w-full rounded border border-[#595959] bg-[#1f1f1f] text-xs text-[#e2e2e2] focus:outline-none focus:ring-2 focus:ring-[#7a7a7a]"
          value={filterId}
          onChange={(e) => setFilterId(e.target.value)}
          aria-label="Webcam visual filter"
        >
          {Object.keys(WEBCAM_FILTERS).map((id) => (
            <option key={id} value={id}>
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </option>
          ))}
        </select>
      </label>

      <label className="mb-2 flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b1b1b1]">Face</span>
        <select
          className="select select-sm h-8 min-h-8 w-full rounded border border-[#595959] bg-[#1f1f1f] text-xs text-[#e2e2e2] focus:outline-none focus:ring-2 focus:ring-[#7a7a7a]"
          value={faceMode}
          onChange={(e) => setFaceMode(e.target.value)}
          aria-label="Face overlay mode"
        >
          <option value="none">Normal</option>
          <option value="rapper">Rapper mask (tracks face)</option>
        </select>
      </label>

      <div className="mb-2 flex items-center gap-2 rounded border border-[#4c4c4c] bg-[#141414]/90 px-2 py-1">
        <span className="h-3 w-3 rounded-full border border-[#666666] bg-[#4b4b4b]" />
        <span className="h-3 w-3 rounded-full border border-[#666666] bg-[#4b4b4b]" />
        <span className="h-[2px] flex-1 rounded bg-[#7a7a7a]" />
      </div>

      {faceMode === 'rapper' && landmarkerError && (
        <div className="alert border-none bg-[#5b4317]/90 py-2 text-[#ffe6b8]">
          <span className="text-xs">{landmarkerError}</span>
        </div>
      )}

      {/* `display:none` (Tailwind `hidden`) stops many browsers from decoding video — keep the
          feed in the layout when drawing to canvas (opacity-0 + absolute). */}
      <div
        className={`relative w-full overflow-hidden rounded border border-[#4f4f4f] bg-[#121212] ${
          faceMode === 'rapper' ? 'aspect-video min-h-[160px]' : ''
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={
            faceMode === 'rapper'
              ? 'absolute inset-0 z-0 h-full w-full object-cover opacity-0 pointer-events-none'
              : `block w-full rounded bg-[#141414] ${isOn ? '' : 'opacity-30'}`
          }
          style={
            faceMode === 'none'
              ? {
                  transform: 'scaleX(-1)',
                  filter: WEBCAM_FILTERS[filterId] ?? WEBCAM_FILTERS.none,
                }
              : undefined
          }
        />

        {faceMode === 'rapper' && (
          <>
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 z-10 h-full w-full rounded bg-[#141414] ${
                isOn ? '' : 'opacity-30'
              }`}
            />
            {isOn && landmarkerLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded bg-[#131313]/85 pointer-events-none">
                <span className="rounded border border-[#5b5b5b] bg-[#242424] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#d0d0d0]">
                  Loading Face Tracking...
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
