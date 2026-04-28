import { useEffect, useState, useRef } from 'react';
import { playChord } from '../audio/audioEngine';
import { exportMidiMultiTrack, importMidiMultiTrack } from '../audio/midiExport';
import ChordForm from '../components/ChordForm';
import WebcamComponent from '../components/WebcamComponent';

/**
 * Instruments available for each track.
 * The track grid uses these values for playback sound selection.
 */
const INSTRUMENTS = ['piano', 'guitar', 'bass', 'drums'];

/**
 * Track colors are used to visually distinguish each track in the step sequencer.
 */
const TRACK_COLORS = ['#6eb6ff', '#ffa94d', '#c77dff', '#9be15d', '#ff8787', '#66d9e8'];

/**
 * Return the length of a slot map as the number of used beat columns.
 * Slots are stored as sparse objects keyed by numeric beat index.
 */
function getLen(slots) {
    const keys = Object.keys(slots).map(Number);
    return keys.length === 0 ? 0 : Math.max(...keys) + 1;
}

/**
 * Convert seconds into a human-readable minutes:seconds string.
 * Used for MP3 track playback display.
 */
function formatClock(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const whole = Math.floor(sec);
    const m = Math.floor(whole / 60);
    const s = whole % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * StudioPage is the main composition workspace for the app.
 * It renders the track sidebar, step sequencer grid, playback controls,
 * MIDI import/export, MP3 upload, and an interactive webcam panel.
 */
function StudioPage() {
    const [tracks, setTracks] = useState([
        { id: crypto.randomUUID(), name: 'Track 1', instrument: 'piano', muted: false, slots: {} }
    ]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeStep, setActiveStep] = useState(null);
    const [selectedTrack, setSelectedTrack] = useState(null);
    const [dragSrc, setDragSrc] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [audioTrack, setAudioTrack] = useState(null);
    const [audioDuration, setAudioDuration] = useState(0);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const [discoMode, setDiscoMode] = useState(false);
    const [discoSpeed, setDiscoSpeed] = useState(1100);
    const playbackRef = useRef(null);
    const tracksRef = useRef(tracks);
    const fileInputRef = useRef(null);
    const mp3InputRef = useRef(null);
    const audioRef = useRef(null);
    const particleCanvasRef = useRef(null);

    useEffect(() => {
        tracksRef.current = tracks;
    }, [tracks]);

    useEffect(() => {
        const canvas = particleCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let rafId = 0;
        let particles = [];
        const mouse = { x: 0, y: 0, active: false };

        function resize() {
            const dpr = window.devicePixelRatio || 1;
            const width = window.innerWidth;
            const height = window.innerHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const count = Math.max(52, Math.min(120, Math.floor((width * height) / 18000)));
            particles = Array.from({ length: count }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.22,
                vy: (Math.random() - 0.5) * 0.22,
                r: Math.random() * 1.4 + 0.6,
            }));
        }

        function draw() {
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            ctx.clearRect(0, 0, width, height);

            const maxDist = 140;
            const maxDistSq = maxDist * maxDist;
            const mouseDist = 170;
            const mouseDistSq = mouseDist * mouseDist;

            for (let i = 0; i < particles.length; i += 1) {
                const p = particles[i];
                if (!reducedMotion) {
                    p.x += p.vx;
                    p.y += p.vy;
                    if (p.x <= 0 || p.x >= width) p.vx *= -1;
                    if (p.y <= 0 || p.y >= height) p.vy *= -1;
                    p.x = Math.max(0, Math.min(width, p.x));
                    p.y = Math.max(0, Math.min(height, p.y));
                }

                for (let j = i + 1; j < particles.length; j += 1) {
                    const q = particles[j];
                    const dx = p.x - q.x;
                    const dy = p.y - q.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq > maxDistSq) continue;
                    const alpha = (1 - distSq / maxDistSq) * 0.22;
                    ctx.strokeStyle = `rgba(190, 190, 190, ${alpha})`;
                    ctx.lineWidth = 0.8;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(q.x, q.y);
                    ctx.stroke();
                }

                if (mouse.active) {
                    const mdx = p.x - mouse.x;
                    const mdy = p.y - mouse.y;
                    const mouseSq = mdx * mdx + mdy * mdy;
                    if (mouseSq < mouseDistSq) {
                        const alpha = (1 - mouseSq / mouseDistSq) * 0.32;
                        ctx.strokeStyle = `rgba(210, 210, 210, ${alpha})`;
                        ctx.lineWidth = 0.95;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.stroke();
                    }
                }
            }

            for (const p of particles) {
                ctx.fillStyle = 'rgba(225, 225, 225, 0.55)';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }

            if (mouse.active) {
                ctx.fillStyle = 'rgba(230, 230, 230, 0.28)';
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, 2.4, 0, Math.PI * 2);
                ctx.fill();
            }

            if (!reducedMotion) {
                rafId = window.requestAnimationFrame(draw);
            }
        }

        function onPointerMove(e) {
            const rect = canvas.getBoundingClientRect();
            const nextX = e.clientX - rect.left;
            const nextY = e.clientY - rect.top;
            const inBounds = nextX >= 0 && nextX <= rect.width && nextY >= 0 && nextY <= rect.height;
            mouse.x = nextX;
            mouse.y = nextY;
            mouse.active = inBounds;
            if (reducedMotion) draw();
        }

        function onPointerLeave() {
            mouse.active = false;
            if (reducedMotion) draw();
        }

        resize();
        draw();
        window.addEventListener('resize', resize);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerleave', onPointerLeave);

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerleave', onPointerLeave);
            if (rafId) window.cancelAnimationFrame(rafId);
        };
    }, []);

    const maxLen = Math.max(...tracks.map(t => getLen(t.slots)), 0);
    const gridCols = maxLen + 1;
    const hasBlocks = maxLen > 0;
    const hasAudioTrack = Boolean(audioTrack?.url);
    const hasPlayableContent = hasBlocks || hasAudioTrack;
    const scrubMax = audioDuration > 0 ? audioDuration : 1;
    const discoDuration = 2650 - discoSpeed;

    /**
     * Sync the current sequencer step with MP3 playback time.
     * This keeps the step indicator aligned when an audio track is playing.
     */
    function syncStepWithAudioTime(currentSec, durationSec = audioDuration) {
        if (!hasBlocks || !Number.isFinite(currentSec) || !Number.isFinite(durationSec) || durationSec <= 0) {
            return;
        }
        const ratio = Math.min(Math.max(currentSec / durationSec, 0), 1);
        const step = Math.min(maxLen - 1, Math.floor(ratio * maxLen));
        setActiveStep(Math.max(step, 0));
    }

    /**
     * Stop all playback and optionally reset playback position.
     * Handles both sequencer loop and MP3 audio element state.
     */
    function stopPlayback(resetPosition = false) {
        clearInterval(playbackRef.current);
        playbackRef.current = null;
        if (audioRef.current) {
            audioRef.current.onended = null;
            audioRef.current.pause();
            if (resetPosition) {
                audioRef.current.currentTime = 0;
            }
        }
        if (resetPosition) {
            setAudioCurrentTime(0);
        }
        setIsPlaying(false);
        if (resetPosition) {
            setActiveStep(null);
        }
    }

    /**
     * Handle MP3 file selection and register it as the active audio track.
     * Rejects non-MP3 files and manages object URL cleanup for previous uploads.
     */
    function onMp3Upload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const isMp3 = file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3');
        if (!isMp3) {
            alert('Please upload an MP3 file.');
            e.target.value = '';
            return;
        }
        if (audioTrack?.url) {
            URL.revokeObjectURL(audioTrack.url);
        }
        const url = URL.createObjectURL(file);
        setAudioTrack({
            id: crypto.randomUUID(),
            name: file.name.replace(/\.mp3$/i, ''),
            url,
        });
        setAudioCurrentTime(0);
        setAudioDuration(0);
        e.target.value = '';
    }

    /**
     * Remove the currently uploaded MP3 track, reset audio state, and cancel playback.
     */
    function removeMp3Track() {
        if (isPlaying) stopPlayback(true);
        if (audioTrack?.url) {
            URL.revokeObjectURL(audioTrack.url);
        }
        if (selectedTrack === audioTrack?.id) setSelectedTrack(null);
        setAudioTrack(null);
        setAudioCurrentTime(0);
        setAudioDuration(0);
    }

    /**
     * Add a new empty track to the sequencer with the next instrument and default naming.
     */
    function addTrack() {
        let num = tracks.length + 1;
        let inst = INSTRUMENTS[tracks.length % INSTRUMENTS.length];
        setTracks([...tracks, { id: crypto.randomUUID(), name: `Track ${num}`, instrument: inst, muted: false, slots: {} }]);
    }

    /**
     * Remove a sequencer track by id and clear selection if it was active.
     */
    function removeTrack(id) {
        setTracks(tracks.filter(t => t.id !== id));
        if (selectedTrack === id) setSelectedTrack(null);
    }

    /**
     * Update track metadata such as name, instrument, or muted state.
     */
    function updateTrack(id, changes) {
        setTracks(tracks.map(t => t.id === id ? { ...t, ...changes } : t));
    }
},{
    function addBlock(trackId, block) {
        setTracks(prev => prev.map(t => {
            if (t.id !== trackId) return t;
            let next = getLen(t.slots);
            return { ...t, slots: { ...t.slots, [next]: block } };
        }));
    }

    function removeBlock(trackId, slot) {
        setTracks(prev => prev.map(t => {
            if (t.id !== trackId) return t;
            let s = { ...t.slots };
            delete s[slot];
            return { ...t, slots: s };
        }));
    }

    // drag n drop
    function onDrop(toTrackId, toSlot) {
        if (!dragSrc) return;
        let { trackId: fromId, slot: fromSlot } = dragSrc;
        if (fromId === toTrackId && fromSlot === toSlot) {
            setDragSrc(null); setDropTarget(null);
            return;
        }

        setTracks(prev => {
            let next = prev.map(t => ({ ...t, slots: { ...t.slots } }));
            let from = next.find(t => t.id === fromId);
            let to = next.find(t => t.id === toTrackId);
            if (!from || !to) return prev;

            let srcBlock = from.slots[fromSlot];
            let dstBlock = to.slots[toSlot];

            // swap if theres already something there, otherwise just move
            if (fromId === toTrackId) {
                if (dstBlock) from.slots[fromSlot] = dstBlock;
                else delete from.slots[fromSlot];
                from.slots[toSlot] = srcBlock;
            } else {
                if (dstBlock) from.slots[fromSlot] = dstBlock;
                else delete from.slots[fromSlot];
                to.slots[toSlot] = srcBlock;
            }
            return next;
        });
        setDragSrc(null);
        setDropTarget(null);
    }

    function play() {
        if (isPlaying || playbackRef.current) {
            stopPlayback();
            return;
        }
        if (!hasPlayableContent) return;

        if (audioRef.current && hasAudioTrack) {
            audioRef.current.play().catch(() => {});
        }

        if (!hasBlocks) {
            setIsPlaying(true);
            setActiveStep(null);
            if (audioRef.current) {
                const onEnded = () => {
                    setIsPlaying(false);
                    setAudioCurrentTime(audioDuration);
                };
                audioRef.current.onended = onEnded;
            }
            return;
        }

        let step = 0;
        if (hasAudioTrack && audioDuration > 0) {
            const ratio = Math.min(Math.max(audioCurrentTime / audioDuration, 0), 1);
            step = Math.min(maxLen - 1, Math.floor(ratio * maxLen));
        } else if (activeStep != null && activeStep >= 0) {
            step = Math.min(activeStep, Math.max(maxLen - 1, 0));
        }
        setIsPlaying(true);

        function tick() {
            let cur = tracksRef.current;
            let len = Math.max(...cur.map(t => getLen(t.slots)), 0);
            if (len === 0) { stopPlayback(); return; }

            step = step % len;
            setActiveStep(step);

            for (let track of cur) {
                if (track.muted || !track.slots[step]) continue;
                let block = track.slots[step];
                playChord(block.toNotes(), block.chord.rootNote, block.chord.octave, track.instrument);
            }
            step = (step + 1) % len;
        }
        tick();
        playbackRef.current = setInterval(tick, 1000);
    }

    useEffect(() => {
        return () => {
            if (audioTrack?.url) {
                URL.revokeObjectURL(audioTrack.url);
            }
        };
    }, [audioTrack]);

    /**
     * Wire audio element events for MP3 playback metadata, time updates, and completion.
     * The sequencer syncs active steps while the audio track is playing.
     */
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;

        function onLoadedMeta() {
            setAudioDuration(Number.isFinite(el.duration) ? el.duration : 0);
        }
        function onTimeUpdate() {
            setAudioCurrentTime(el.currentTime || 0);
            syncStepWithAudioTime(el.currentTime || 0, el.duration || audioDuration);
        }
        function onEnded() {
            clearInterval(playbackRef.current);
            playbackRef.current = null;
            setIsPlaying(false);
            setAudioCurrentTime(Number.isFinite(el.duration) ? el.duration : 0);
            if (hasBlocks) setActiveStep(Math.max(maxLen - 1, 0));
        }

        el.addEventListener('loadedmetadata', onLoadedMeta);
        el.addEventListener('timeupdate', onTimeUpdate);
        el.addEventListener('ended', onEnded);

        return () => {
            el.removeEventListener('loadedmetadata', onLoadedMeta);
            el.removeEventListener('timeupdate', onTimeUpdate);
            el.removeEventListener('ended', onEnded);
        };
    }, [audioTrack, hasBlocks, maxLen, audioDuration]);

    function onAudioScrub(e) {
        const next = Number(e.target.value);
        if (!Number.isFinite(next)) return;
        setAudioCurrentTime(next);
        if (audioRef.current) {
            audioRef.current.currentTime = next;
        }
        syncStepWithAudioTime(next);
    }

    function doExport() {
        let data = tracks.map(t => {
            let blocks = [];
            for (let i = 0; i < getLen(t.slots); i++) {
                if (t.slots[i]) blocks.push(t.slots[i]);
            }
            return { ...t, blocks };
        });
        exportMidiMultiTrack(data);
    }

    async function doImport(e) {
        let file = e.target.files[0];
        if (!file) return;
        try {
            let imported = await importMidiMultiTrack(file);
            // convert blocks arrays back to slot objects
            setTracks(imported.map(t => {
                let slots = {};
                t.blocks.forEach((b, i) => { slots[i] = b; });
                return { ...t, slots };
            }));
        } catch (err) {
            console.error('MIDI import failed:', err);
        }
        e.target.value = '';
    }

    const selectedMidiTrack = tracks.find(t => t.id === selectedTrack);

    return (
        <div
            className={`relative h-screen flex flex-col overflow-hidden bg-[#141414] text-[#d7d7d7] ${discoMode ? 'disco-mode' : ''}`}
            style={{
                '--disco-hue-duration': `${discoDuration}ms`,
                '--disco-flash-duration': `${Math.max(220, Math.floor(discoDuration * 0.52))}ms`,
            }}
        >
            <div className="pointer-events-none absolute inset-0">
                <canvas ref={particleCanvasRef} className="particle-network-canvas absolute inset-0 h-full w-full" />
            </div>
            {discoMode && <div className="disco-flash-overlay pointer-events-none absolute inset-0 z-40" />}
            <div className="flex items-center gap-2 border-b border-[#3d3d3d] bg-[#1d1d1d] px-4 py-2">
                <h1 className="mr-4 text-sm font-bold uppercase tracking-[0.22em] text-[#e5e5e5]">Beats by Ben</h1>
                <button
                    className="btn btn-sm h-8 min-h-8 rounded border-0 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#111]"
                    style={{
                        backgroundImage:
                            'linear-gradient(120deg, #ff4d6d 0%, #ff9e3d 22%, #f9f871 42%, #5be37a 60%, #57c7ff 78%, #c180ff 100%)',
                    }}
                    onClick={play} disabled={!hasPlayableContent}>
                    {isPlaying ? 'Stop' : 'Play'}
                </button>
                <span className="ml-2 rounded border border-[#5e5e5e] bg-[#242424] px-2 py-1 font-mono text-[10px] text-[#bdbdbd]">
                    120 BPM
                </span>
                <button
                    className={`btn btn-xs h-7 min-h-7 rounded border px-3 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        discoMode
                            ? 'border-[#9f9f9f] bg-[#6a6a6a] text-[#fff]'
                            : 'border-[#5b5b5b] bg-[#2a2a2a] text-[#cecece]'
                    }`}
                    onClick={() => setDiscoMode((v) => !v)}
                >
                    {discoMode ? 'Disco On' : 'Disco Off'}
                </button>
                <label className="ml-1 flex items-center gap-2 rounded border border-[#4e4e4e] bg-[#232323] px-2 py-1">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#aaaaaa]">Speed</span>
                    <input
                        type="range"
                        min={450}
                        max={2200}
                        step={50}
                        value={discoSpeed}
                        onChange={(e) => setDiscoSpeed(Number(e.target.value))}
                        className="range range-xs w-20 [--range-bg:#181818] [--range-fill:#909090] [--range-thumb:#d6d6d6]"
                        aria-label="Disco mode speed"
                    />
                </label>
                <div className="flex-1" />
                <button
                    className="btn btn-sm h-8 min-h-8 rounded border border-[#606060] bg-[#2a2a2a] px-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#cfcfcf] hover:bg-[#353535]"
                    onClick={doExport}
                    disabled={!hasBlocks}
                >
                    Export MIDI
                </button>
                <button
                    className="btn btn-sm h-8 min-h-8 rounded border border-[#606060] bg-[#2a2a2a] px-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#cfcfcf] hover:bg-[#353535]"
                    onClick={() => fileInputRef.current.click()}
                >
                    Import MIDI
                </button>
                <input ref={fileInputRef} type="file" accept=".mid,.midi" className="hidden" onChange={doImport} />
                <button
                    className="btn btn-sm h-8 min-h-8 rounded border border-[#606060] bg-[#2a2a2a] px-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#cfcfcf] hover:bg-[#353535]"
                    onClick={() => mp3InputRef.current.click()}
                >
                    Upload MP3
                </button>
                <input ref={mp3InputRef} type="file" accept=".mp3,audio/mpeg" className="hidden" onChange={onMp3Upload} />
                <button
                    className="btn btn-sm h-8 min-h-8 rounded border border-[#5f5f5f] bg-[#4a4a4a] px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#e6e6e6]"
                    onClick={addTrack}
                >
                    + Track
                </button>
            </div>

            <div className="relative z-10 flex flex-1 overflow-hidden">
                <div className="w-52 shrink-0 overflow-y-auto border-r border-[#3d3d3d] bg-[#181818]">
                    <div className="h-7 border-b border-[#474747] bg-[#272727]" />
                    {audioTrack && (
                        <div className={`flex h-16 cursor-pointer flex-col justify-center border-b border-[#474747] px-3 py-1 ${
                            selectedTrack === audioTrack.id ? 'bg-[#3a3a3a]' : 'hover:bg-[#343434]'
                        }`} onClick={() => setSelectedTrack(selectedTrack === audioTrack.id ? null : audioTrack.id)}>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-[#a0a0a0]" />
                                <span className="truncate text-sm font-semibold text-[#e4e4e4]">{audioTrack.name}</span>
                            </div>
                            <div className="flex items-center gap-2 ml-4 mt-0.5">
                                <span className="text-xs text-[#a2a2a2]">MP3 track</span>
                                <button className="btn btn-ghost btn-xs text-[#7b7b7b] hover:text-[#ef5f5f]"
                                    onClick={e => { e.stopPropagation(); removeMp3Track(); }}>
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}
                    {tracks.map((track, idx) => (
                        <div key={track.id}
                            className={`flex h-16 cursor-pointer flex-col justify-center border-b border-[#474747] px-3 py-1 ${
                                selectedTrack === track.id ? 'bg-[#3a3a3a]' : 'hover:bg-[#343434]'}`}
                            onClick={() => setSelectedTrack(selectedTrack === track.id ? null : track.id)}>
                            <div className="flex items-center gap-2">
                                <div
                                    className={`h-2 w-2 rounded-full ${track.muted ? 'opacity-30' : ''}`}
                                    style={{ backgroundColor: TRACK_COLORS[idx % TRACK_COLORS.length] }}
                                />
                                <input className="w-full bg-transparent text-sm font-semibold text-[#e2e2e2] outline-none"
                                    value={track.name}
                                    onChange={e => updateTrack(track.id, { name: e.target.value })}
                                    onClick={e => e.stopPropagation()} />
                            </div>
                            <div className="flex items-center gap-1 ml-4 mt-0.5">
                                <select
                                    className="select select-xs h-6 min-h-6 rounded border border-[#595959] bg-[#202020] p-0 px-1 text-[10px] uppercase tracking-[0.06em] text-[#b4b4b4]"
                                    value={track.instrument}
                                    onChange={e => updateTrack(track.id, { instrument: e.target.value })}
                                    onClick={e => e.stopPropagation()}>
                                    {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                                </select>
                                <button
                                    className={`btn btn-ghost btn-xs h-6 min-h-6 px-1 text-[10px] ${
                                        track.muted ? 'text-[#ef5f5f]' : 'text-[#8d8d8d]'
                                    }`}
                                    onClick={e => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }); }}>
                                    M
                                </button>
                                {tracks.length > 1 &&
                                    <button className="btn btn-ghost btn-xs h-6 min-h-6 px-1 text-[#7b7b7b] hover:text-[#ef5f5f]"
                                        onClick={e => { e.stopPropagation(); removeTrack(track.id); }}>
                                        ✕
                                    </button>}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex-1 overflow-auto">
                    {/* beat numbers */}
                    <div className="sticky top-0 z-10 flex h-7 border-b border-[#3f3f3f] bg-[#202020]">
                        {Array.from({ length: gridCols }).map((_, i) =>
                            <div key={i} className={`flex w-24 shrink-0 items-center border-r border-[#3f3f3f] px-2 font-mono text-xs ${
                                activeStep === i ? 'font-bold text-[#d6d6d6]' : 'text-[#9b9b9b]'
                            }`}>
                                {i + 1}
                            </div>
                        )}
                    </div>

                    {tracks.map((track, tIdx) =>
                        <div key={track.id} className={`flex h-16 border-b border-[#3f3f3f] ${
                            selectedTrack === track.id ? 'bg-[#2f2f2f]' : 'bg-[#242424]'
                        }`}>
                            {Array.from({ length: gridCols }).map((_, col) => {
                                let block = track.slots[col];
                                let active = activeStep === col;
                                let color = TRACK_COLORS[tIdx % TRACK_COLORS.length];
                                let hovering = dropTarget?.trackId === track.id && dropTarget?.slot === col;
                                let isDragged = dragSrc?.trackId === track.id && dragSrc?.slot === col;

                                return <div key={col}
                                    className={`relative h-full w-24 shrink-0 border-r border-[#343434] p-1 ${
                                        active && isPlaying ? 'bg-[#7d7d7d1f]' : ''
                                    } ${hovering && dragSrc ? 'bg-[#7d7d7d2d]' : ''}`}
                                    onDragOver={e => { e.preventDefault(); setDropTarget({ trackId: track.id, slot: col }); }}
                                    onDragLeave={() => setDropTarget(null)}
                                    onDrop={() => onDrop(track.id, col)}>

                                    {active && isPlaying && <div className="absolute bottom-0 left-0 top-0 w-0.5 bg-[#b3b3b3]" />}

                                    {block && <div draggable
                                        onDragStart={() => setDragSrc({ trackId: track.id, slot: col })}
                                        onDragEnd={() => { setDragSrc(null); setDropTarget(null); }}
                                        className={`group relative flex h-full cursor-grab flex-col justify-center rounded px-2 active:cursor-grabbing ${
                                            track.muted ? 'opacity-20' : active && isPlaying ? 'opacity-95' : 'opacity-70'
                                        } ${isDragged ? 'opacity-20!' : ''}`}
                                        style={{
                                            backgroundColor: color,
                                        }}
                                    >
                                        <span className="text-sm font-bold leading-tight text-[#111]">
                                            {block.chord.rootNote}{block.chord.quality === 'minor' ? 'm' : ''}
                                        </span>
                                        <span className="text-xs leading-tight text-[#111111cc]">Oct {block.chord.octave}</span>
                                        <button className="btn btn-ghost btn-xs absolute right-0 top-0 text-[#111] opacity-0 group-hover:opacity-80"
                                            onClick={() => removeBlock(track.id, col)}>✕</button>
                                    </div>}
                                </div>;
                            })}
                        </div>
                    )}
                </div>

                <div className="flex w-96 shrink-0 flex-col gap-4 overflow-y-auto border-l border-[#3d3d3d] bg-[#1b1b1b] p-4">
                    <WebcamComponent />
                </div>
            </div>

            <div className="relative z-10 flex shrink-0 items-center gap-3 border-t border-[#3d3d3d] bg-[#1d1d1d] px-4 py-2">
                {audioTrack && (
                    <div className="flex items-center gap-3 w-full min-w-0">
                        <audio ref={audioRef} src={audioTrack.url} preload="metadata" className="hidden" />
                        <span className="shrink-0 text-xs uppercase tracking-[0.08em] text-[#9f9f9f]">Track</span>
                        <span className="shrink-0 rounded border border-[#5c5c5c] bg-[#202020] px-2 py-1 font-mono text-xs text-[#c7c7c7]">
                            {formatClock(audioCurrentTime)} / {formatClock(audioDuration)}
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={scrubMax}
                            step={0.01}
                            value={Math.min(audioCurrentTime, scrubMax)}
                            onChange={onAudioScrub}
                            className="range range-xs flex-1 min-w-0 [--range-bg:#1b1b1b] [--range-fill:#8f8f8f] [--range-thumb:#d6d6d6]"
                            aria-label="Track timeline scrubber"
                        />
                    </div>
                )}
                {selectedMidiTrack ? <>
                    <span className="text-xs text-[#b2b2b2]">
                        Adding to: <strong>{selectedMidiTrack.name}</strong>
                    </span>
                    <ChordForm onAdd={block => addBlock(selectedTrack, block)} compact />
                </> : <span className="text-xs text-[#868686]">Click a track to add chords</span>}
            </div>
        </div>
    );
}

export default StudioPage;
