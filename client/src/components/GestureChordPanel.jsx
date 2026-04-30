import { useCallback, useEffect, useRef, useState } from 'react';
import Block from '../models/Block';
import Chord from '../models/Chord';
import { countFingers, detectGesture, getHandLandmarks, getHandedness, normalizeLabel } from '../gestureMapping';
import { drawHandSkeleton } from '../handSkeletonOverlay';

const MP_VERSION = '0.10.34';
const HOLD_MS = 1500;
const MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export default function GestureChordPanel({ onAdd, onConfirmedChord, disabled }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const landmarkerRef = useRef(null);
    const rafRef = useRef(0);
    const lastTsRef = useRef(0);
    const lastGestureRef = useRef({ quality: null, root: null });
    const holdRef = useRef({ quality: null, root: null, since: 0, added: false });
    const progressBarRef = useRef(null);
    const onAddRef = useRef(onAdd);

    const frameCountRef = useRef(0);

    const lastHandCountRef = useRef(0);

    const [active, setActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [gesture, setGesture] = useState({ quality: null, root: null });
    const [handCount, setHandCount] = useState(0);
    const [trackerDebug, setTrackerDebug] = useState({
        handedness: [],
        fingerCounts: [],
        wristX: [],
    });

    useEffect(() => { onAddRef.current = onAdd; }, [onAdd]);

    // Assign stream to video after React mounts the video element (active → true re-render)
    useEffect(() => {
        if (!active || !videoRef.current || !streamRef.current) return;
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
    }, [active]);

    async function enableGestures() {
        setError(null);
        setLoading(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 } },
            });
            streamRef.current = stream;
            setActive(true); // video element mounts → useEffect above wires srcObject
        } catch (err) {
            setError(err.message || 'Webcam access denied');
            setLoading(false);
        }
    }

    function disableGestures() {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        landmarkerRef.current?.close();
        landmarkerRef.current = null;
        lastGestureRef.current = { quality: null, root: null };
        holdRef.current = { quality: null, root: null, since: 0, added: false };
        if (progressBarRef.current) progressBarRef.current.style.width = '0%';
        frameCountRef.current = 0;
        lastHandCountRef.current = 0;
        setActive(false);
        setGesture({ quality: null, root: null });
        setHandCount(0);
    }

    // Load HandLandmarker once webcam is active
    useEffect(() => {
        if (!active) return;
        let cancelled = false;

        (async () => {
            try {
                const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
                const wasm = await FilesetResolver.forVisionTasks(
                    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`,
                );

                const tryCreate = (delegate) =>
                    HandLandmarker.createFromOptions(wasm, {
                        baseOptions: { modelAssetPath: MODEL_URL, delegate },
                        runningMode: 'VIDEO',
                        numHands: 2,
                    });

                let lm;
                try {
                    lm = await tryCreate('GPU');
                } catch {
                    lm = await tryCreate('CPU');
                }

                if (cancelled) { lm.close(); return; }
                landmarkerRef.current = lm;
                console.log('[GestureChords] HandLandmarker ready');
            } catch (e) {
                if (!cancelled) setError(e?.message || 'Failed to load hand tracking');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [active]);

    const drawFrame = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) return;

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw === 0 || vh === 0) return;

        if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
        }

        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-vw, 0);
        ctx.drawImage(video, 0, 0, vw, vh);
        ctx.restore();

        const lmr = landmarkerRef.current;
        if (!lmr) return;

        let ts = performance.now();
        if (ts <= lastTsRef.current) ts = lastTsRef.current + 0.001;
        lastTsRef.current = ts;

        let results;
        try {
            results = lmr.detectForVideo(video, ts);
        } catch { return; }

        drawHandSkeleton(ctx, results, vw, vh);

        const landmarks = getHandLandmarks(results);
        const handednesses = getHandedness(results);
        const count = landmarks.length;
        if (count !== lastHandCountRef.current) {
            lastHandCountRef.current = count;
            setHandCount(count);
        }

        const handednessDebug = handednesses.map((entry) => normalizeLabel(entry) ?? 'unknown');
        const fingerDebug = landmarks.map((lm, index) => String(countFingers(lm, handednesses[index])));
        const wristXDebug = landmarks.map((lm) => lm[0].x.toFixed(2));

        setTrackerDebug((prev) => {
            const sameHandedness = prev.handedness.join('|') === handednessDebug.join('|');
            const sameFingerCounts = prev.fingerCounts.join('|') === fingerDebug.join('|');
            const sameWristX = prev.wristX.join('|') === wristXDebug.join('|');
            if (sameHandedness && sameFingerCounts && sameWristX) return prev;
            return {
                handedness: handednessDebug,
                fingerCounts: fingerDebug,
                wristX: wristXDebug,
            };
        });

        const { quality, root } = detectGesture(results);

        // Log every ~90 frames so you can verify what's being detected in DevTools
        frameCountRef.current++;
        if (frameCountRef.current % 90 === 0) {
            const debugSnapshot = {
                hands: count,
                handedness: handednessDebug,
                wristX: wristXDebug,
                fingers: fingerDebug,
                quality,
                root,
            };
            console.log(`[GestureChords] ${JSON.stringify(debugSnapshot)}`);
        }

        // Throttle React state updates to when gesture actually changes
        if (quality !== lastGestureRef.current.quality || root !== lastGestureRef.current.root) {
            lastGestureRef.current = { quality, root };
            setGesture({ quality, root });
        }

        // Hold timer — mutates refs and DOM directly to avoid 60fps React renders
        const h = holdRef.current;
        const now = performance.now();
        if (quality && root) {
            if (h.quality === quality && h.root === root) {
                const elapsed = now - h.since;
                const progress = Math.min(elapsed / HOLD_MS, 1);
                if (progressBarRef.current) progressBarRef.current.style.width = `${progress * 100}%`;
                if (!h.added && elapsed >= HOLD_MS) {
                    h.added = true;
                    const block = new Block(new Chord(root, 4, quality));
                    onAddRef.current?.(block);
                    onConfirmedChord?.(block);
                }
            } else {
                holdRef.current = { quality, root, since: now, added: false };
                if (progressBarRef.current) progressBarRef.current.style.width = '0%';
            }
        } else {
            holdRef.current = { quality: null, root: null, since: 0, added: false };
            if (progressBarRef.current) progressBarRef.current.style.width = '0%';
        }
    }, []);

    useEffect(() => {
        if (!active) return;
        const tick = () => {
            drawFrame();
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [active, drawFrame]);

    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const chord =
        gesture.quality && gesture.root ? `${gesture.root} ${gesture.quality}` : null;
    const buttonDisabled = disabled && !active;

    return (
        <div className="rounded-lg border border-[#3f3f3f] bg-[#1a1a1a] p-3">
            <div className="mb-2 flex items-center justify-between border-b border-[#4a4a4a] pb-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#dddddd]">
                    Gesture Chords
                </h3>
                <button
                    type="button"
                    disabled={buttonDisabled}
                    onClick={active ? disableGestures : enableGestures}
                    className={`btn btn-xs h-7 min-h-7 rounded border-0 px-3 text-[10px] font-semibold uppercase tracking-wide ${
                        active
                            ? 'bg-[#b6424a] text-[#ffe4e7]'
                            : 'bg-[#616161] text-[#f3f3f3]'
                    } ${buttonDisabled ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                    {active ? 'Disable' : 'Enable Gestures'}
                </button>
            </div>

            {!active && disabled && (
                <p className="text-[11px] text-[#7a7a7a]">Select a track first to use gesture input.</p>
            )}

            {error && (
                <div className="mb-2 rounded border border-[#5b1f24] bg-[#3a1214] px-2 py-1 text-xs text-[#ffd8dc]">
                    {error}
                </div>
            )}

            {active && (
                <>
                    {/* Webcam preview — video stays in DOM (opacity-0) so the browser keeps decoding frames */}
                    <div className="relative mb-2 aspect-video min-h-[150px] overflow-hidden rounded border border-[#4f4f4f] bg-[#121212]">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-0"
                        />
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 z-10 h-full w-full"
                        />
                        {loading && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#131313]/85">
                                <span className="rounded border border-[#5b5b5b] bg-[#242424] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#d0d0d0]">
                                    Loading hand tracking…
                                </span>
                            </div>
                        )}
                    </div>

                    {disabled && (
                        <div className="mb-2 rounded border border-[#5b4510] bg-[#3a2a0a] px-2 py-1 text-[11px] text-[#ffd8a8]">
                            No track selected — select a track to add chords.
                        </div>
                    )}

                    {/* Live gesture status */}
                    <div className="mb-2 rounded border border-[#4c4c4c] bg-[#141414] px-2 py-1.5">
                        <div className="mb-0.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.1em] text-[#888]">
                            <span>Detected</span>
                            <span className="font-mono text-[#666]">Hands: {handCount}</span>
                        </div>
                        <div className="font-mono text-xs text-[#d4d4d4]">
                            <span className="text-[#a78bfa]">Left: {gesture.quality ?? '—'}</span>
                            {' | '}
                            <span className="text-[#34d399]">Right: {gesture.root ?? '—'}</span>
                            {' → '}
                            <span className="font-bold text-[#f0f0f0]">{chord ?? '—'}</span>
                        </div>
                    </div>

                    {/* Hold-to-confirm progress bar (DOM-direct to avoid 60fps re-renders) */}
                    <div className="mb-2">
                        <div className="mb-0.5 text-[9px] text-[#666]">Hold to confirm</div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2e2e2e]">
                            <div
                                ref={progressBarRef}
                                className="h-full rounded-full bg-[#6ee7b7]"
                                style={{ width: '0%' }}
                            />
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="space-y-0.5 text-[9px] text-[#666]">
                        <div>
                            <span className="text-[#a78bfa]">Left hand:</span>
                            {' '}open palm (4+) = major · fist (0–1) = minor
                        </div>
                        <div>
                            <span className="text-[#34d399]">Right hand:</span>
                            {' '}1=C  2=D  3=E  4=F  5=G
                        </div>
                    </div>

                    <div className="mt-2 rounded border border-[#343434] bg-[#101010] px-2 py-1.5 font-mono text-[10px] text-[#8d8d8d]">
                        <div>handedness: {trackerDebug.handedness.length ? trackerDebug.handedness.join(', ') : '—'}</div>
                        <div>fingers: {trackerDebug.fingerCounts.length ? trackerDebug.fingerCounts.join(', ') : '—'}</div>
                        <div>wrist x: {trackerDebug.wristX.length ? trackerDebug.wristX.join(', ') : '—'}</div>
                    </div>
                </>
            )}
        </div>
    );
}
