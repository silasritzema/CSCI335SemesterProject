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
const HAND_LM = {
  wrist: 0,
  thumbCmc: 1,
  thumbMcp: 2,
  thumbIp: 3,
  thumbTip: 4,
  indexPip: 6,
  indexTip: 8,
  middlePip: 10,
  middleTip: 12,
  ringPip: 14,
  ringTip: 16,
  pinkyPip: 18,
  pinkyTip: 20,
};
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

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

function drawHandOverlay(ctx, landmarks, vw, vh) {
  const mx = (x) => (1 - x) * vw;
  const my = (y) => y * vh;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(190, 190, 190, 0.9)';
  for (const [a, b] of HAND_CONNECTIONS) {
    const p1 = landmarks[a];
    const p2 = landmarks[b];
    if (!p1 || !p2) continue;
    ctx.beginPath();
    ctx.moveTo(mx(p1.x), my(p1.y));
    ctx.lineTo(mx(p2.x), my(p2.y));
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(230, 230, 230, 0.95)';
  for (const p of landmarks) {
    ctx.beginPath();
    ctx.arc(mx(p.x), my(p.y), 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function classifyHandGesture(landmarks) {
  const thumbReach =
    Math.abs(landmarks[HAND_LM.thumbTip].x - landmarks[HAND_LM.thumbMcp].x) >
    Math.abs(landmarks[HAND_LM.thumbIp].x - landmarks[HAND_LM.thumbMcp].x) + 0.02;
  const indexUp = landmarks[HAND_LM.indexTip].y < landmarks[HAND_LM.indexPip].y - 0.02;
  const middleUp = landmarks[HAND_LM.middleTip].y < landmarks[HAND_LM.middlePip].y - 0.02;
  const ringUp = landmarks[HAND_LM.ringTip].y < landmarks[HAND_LM.ringPip].y - 0.02;
  const pinkyUp = landmarks[HAND_LM.pinkyTip].y < landmarks[HAND_LM.pinkyPip].y - 0.02;
  const wristY = landmarks[HAND_LM.wrist].y;
  const thumbY = landmarks[HAND_LM.thumbTip].y;
  const dx = landmarks[HAND_LM.thumbTip].x - landmarks[HAND_LM.indexTip].x;
  const dy = landmarks[HAND_LM.thumbTip].y - landmarks[HAND_LM.indexTip].y;
  const pinchDist = Math.hypot(dx, dy);
  const palmScale = Math.max(
    0.001,
    Math.hypot(
      landmarks[HAND_LM.wrist].x - landmarks[HAND_LM.middleTip].x,
      landmarks[HAND_LM.wrist].y - landmarks[HAND_LM.middleTip].y,
    ),
  );
  const isOk = pinchDist / palmScale < 0.24 && middleUp && ringUp && pinkyUp;

  if (isOk) return 'OK Sign';
  if (indexUp && middleUp && !ringUp && !pinkyUp) return 'Peace / Victory';
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return 'Point';
  if (thumbReach && !indexUp && !middleUp && !ringUp && !pinkyUp) {
    if (thumbY < wristY - 0.05) return 'Thumbs Up';
    if (thumbY > wristY + 0.05) return 'Thumbs Down';
    return 'Thumb';
  }
  if (thumbReach && indexUp && middleUp && ringUp && pinkyUp) return 'Open Hand';
  if (!thumbReach && !indexUp && !middleUp && !ringUp && !pinkyUp) return 'Fist';
  if (indexUp && middleUp && ringUp && !pinkyUp) return 'Three Fingers';
  if (indexUp && middleUp && ringUp && pinkyUp) return 'Four Fingers';
  return 'Hand Detected';
}

export default function WebcamComponent({ onGestureAction }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const maskImgRef = useRef(null);
  const rafRef = useRef(0);
  const streamRef = useRef(null);
  /** MediaPipe requires strictly increasing timestamps per stream. */
  const lastVideoFrameTsRef = useRef(0);
  const stableGestureRef = useRef('');
  const stableGestureCountRef = useRef(0);
  const lastActionAtRef = useRef(0);

  const [isOn, setIsOn] = useState(false);
  const [error, setError] = useState(null);
  const [filterId, setFilterId] = useState('none');
  /** 'none' = plain video; 'rapper' = canvas + tracked mask (not a real identity swap). */
  const [faceMode, setFaceMode] = useState('none');
  const [landmarkerLoading, setLandmarkerLoading] = useState(false);
  const [landmarkerError, setLandmarkerError] = useState(null);
  const [gestureLabel, setGestureLabel] = useState('');

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
    if (!isOn || faceMode === 'none') {
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
        setGestureLabel('');
        stableGestureRef.current = '';
        stableGestureCountRef.current = 0;
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
        const { FaceLandmarker, HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const wasm = await FilesetResolver.forVisionTasks(
          `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VERSION}/wasm`,
        );
        const faceModelUrl =
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
        const handModelUrl =
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

        const tryCreate = async (delegate) => {
          if (faceMode === 'rapper') {
            return FaceLandmarker.createFromOptions(wasm, {
              baseOptions: { modelAssetPath: faceModelUrl, delegate },
              runningMode: 'VIDEO',
              numFaces: 1,
            });
          }
          return HandLandmarker.createFromOptions(wasm, {
            baseOptions: { modelAssetPath: handModelUrl, delegate },
            runningMode: 'VIDEO',
            numHands: 1,
          });
        };

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
          setLandmarkerError(e?.message || 'Could not load tracking model');
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
    if (!video || !canvas || !isOn || faceMode === 'none') return;

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
    if (faceMode === 'rapper' && lm && img?.complete && img.naturalWidth > 0) {
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
        setGestureLabel('');
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[FaceLandmarker]', e);
        }
      }
    }

    if (faceMode === 'hands' && lm) {
      try {
        let ts = performance.now();
        if (ts <= lastVideoFrameTsRef.current) {
          ts = lastVideoFrameTsRef.current + 0.001;
        }
        lastVideoFrameTsRef.current = ts;
        const results = lm.detectForVideo(video, ts);
        const landmarks = results.handLandmarks?.[0];
        if (landmarks) {
          drawHandOverlay(ctx, landmarks, vw, vh);
          const gesture = classifyHandGesture(landmarks);
          setGestureLabel(gesture);
          if (gesture === stableGestureRef.current) {
            stableGestureCountRef.current += 1;
          } else {
            stableGestureRef.current = gesture;
            stableGestureCountRef.current = 1;
          }

          const now = performance.now();
          const cooldownMs = 1400;
          const stableFramesNeeded = 6;
          if (stableGestureCountRef.current >= stableFramesNeeded && now - lastActionAtRef.current > cooldownMs) {
            if (gesture === 'Thumbs Up') {
              onGestureAction?.('play');
              lastActionAtRef.current = now;
            } else if (gesture === 'Fist') {
              onGestureAction?.('stop');
              lastActionAtRef.current = now;
            } else if (gesture === 'Peace / Victory') {
              onGestureAction?.('addTrack');
              lastActionAtRef.current = now;
            }
          }
        } else {
          setGestureLabel('No hand detected');
          stableGestureRef.current = '';
          stableGestureCountRef.current = 0;
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[HandLandmarker]', e);
        }
      }
    }
  }, [isOn, faceMode, filterId, onGestureAction]);

  useEffect(() => {
    if (!isOn || faceMode === 'none') {
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
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b1b1b1]">Mode</span>
        <select
          className="select select-sm h-8 min-h-8 w-full rounded border border-[#595959] bg-[#1f1f1f] text-xs text-[#e2e2e2] focus:outline-none focus:ring-2 focus:ring-[#7a7a7a]"
          value={faceMode}
          onChange={(e) => setFaceMode(e.target.value)}
          aria-label="Face overlay mode"
        >
          <option value="none">Normal</option>
          <option value="rapper">Rapper mask (tracks face)</option>
          <option value="hands">Hand gestures (tracks hand)</option>
        </select>
      </label>

      <div className="mb-2 flex items-center gap-2 rounded border border-[#4c4c4c] bg-[#141414]/90 px-2 py-1">
        <span className="h-3 w-3 rounded-full border border-[#666666] bg-[#4b4b4b]" />
        <span className="h-3 w-3 rounded-full border border-[#666666] bg-[#4b4b4b]" />
        <span className="h-[2px] flex-1 rounded bg-[#7a7a7a]" />
      </div>

      {faceMode === 'hands' && (
        <div className="mb-2 rounded border border-[#4b4b4b] bg-[#151515] px-2 py-1 text-[10px] leading-snug text-[#c8c8c8]">
          Thumbs Up = Play | Fist = Stop | Peace = Add Track
        </div>
      )}

      {faceMode !== 'none' && landmarkerError && (
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
            faceMode !== 'none'
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

        {faceMode !== 'none' && (
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
                  Loading Tracking...
                </span>
              </div>
            )}
            {isOn && faceMode === 'hands' && !landmarkerLoading && (
              <div className="absolute bottom-2 left-2 z-30 rounded border border-[#5b5b5b] bg-[#1d1d1d]/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#dfdfdf]">
                {gestureLabel || 'No hand detected'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
