import { useCallback, useEffect, useState, useRef } from 'react';
import { playChord } from '../audio/audioEngine';
import { exportMidiMultiTrack, importMidiMultiTrack } from '../audio/midiExport';
import { getChordAnnouncement, getTtsStatusLabel, getVoiceOptions, getVoiceTestPhrase, isTtsSupported, speakText } from '../audio/tts';
import ChordForm from '../components/ChordForm';
import GestureChordPanel from '../components/GestureChordPanel';
import TutorialModal from '../components/TutorialModal';
import WebcamComponent from '../components/WebcamComponent';
import { getBackdropModeSummary, getSelectedTrackSummary, getStudioActivitySummary, STUDIO_UTILITY_SECTIONS } from './studioLayout';

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
    const [tutorialOpen, setTutorialOpen] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [availableVoices, setAvailableVoices] = useState([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
    const [bigWebcamMode, setBigWebcamMode] = useState(false);
    const [webcamPoweredOn, setWebcamPoweredOn] = useState(false);
    const playbackRef = useRef(null);
    const tracksRef = useRef(tracks);
    const fileInputRef = useRef(null);
    const mp3InputRef = useRef(null);
    const audioRef = useRef(null);
    const ttsSupported = isTtsSupported();

    useEffect(() => {
        tracksRef.current = tracks;
    }, [tracks]);

    useEffect(() => {
        if (!ttsSupported) return;

        function syncVoices() {
            const voices = globalThis.speechSynthesis?.getVoices?.() ?? [];
            setAvailableVoices(voices);
            setSelectedVoiceURI((current) => {
                const currentOptions = getVoiceOptions(voices);
                if (current && currentOptions.some((voice) => voice.value === current)) {
                    return current;
                }
                return currentOptions[0]?.value || '';
            });
        }

        syncVoices();
        globalThis.speechSynthesis?.addEventListener?.('voiceschanged', syncVoices);

        return () => {
            globalThis.speechSynthesis?.removeEventListener?.('voiceschanged', syncVoices);
        };
    }, [ttsSupported]);

    const maxLen = Math.max(...tracks.map(t => getLen(t.slots)), 0);
    const gridCols = maxLen + 1;
    const hasBlocks = maxLen > 0;
    const hasAudioTrack = Boolean(audioTrack?.url);
    const hasPlayableContent = hasBlocks || hasAudioTrack;
    const scrubMax = audioDuration > 0 ? audioDuration : 1;
    const discoDuration = 2650 - discoSpeed;
    const selectedMidiTrack = tracks.find(t => t.id === selectedTrack);
    const selectedTrackSummary = getSelectedTrackSummary(selectedMidiTrack ?? null);
    const studioActivitySummary = getStudioActivitySummary({
        trackCount: tracks.length,
        hasAudioTrack,
        isPlaying,
    });
    const backdropModeSummary = getBackdropModeSummary({
        bigWebcamMode,
        isWebcamOn: webcamPoweredOn,
    });
    const shellGlassClass = bigWebcamMode
        ? 'border-white/12 bg-[#121212]/60 backdrop-blur-md shadow-[0_18px_55px_rgba(0,0,0,0.34)]'
        : 'border-[#2f2f2f] bg-[#191919]';
    const railGlassClass = bigWebcamMode
        ? 'border-white/12 bg-[#121212]/58 backdrop-blur-md'
        : 'border-[#303030] bg-[#181818]';
    const utilityGlassClass = bigWebcamMode
        ? 'border-white/12 bg-[#121212]/58 backdrop-blur-md'
        : 'border-[#303030] bg-[#171717]';
    const gridGlassClass = bigWebcamMode
        ? 'border-white/12 bg-[#151515]/54 backdrop-blur-sm'
        : 'border-[#303030] bg-[#1a1a1a]';

    /**
     * Sync the current sequencer step with MP3 playback time.
     * This keeps the step indicator aligned when an audio track is playing.
     */
    const syncStepWithAudioTime = useCallback((currentSec, durationSec) => {
        const safeDuration = Number.isFinite(durationSec) ? durationSec : audioDuration;
        if (!hasBlocks || !Number.isFinite(currentSec) || !Number.isFinite(safeDuration) || safeDuration <= 0) {
            return;
        }
        const ratio = Math.min(Math.max(currentSec / safeDuration, 0), 1);
        const step = Math.min(maxLen - 1, Math.floor(ratio * maxLen));
        setActiveStep(Math.max(step, 0));
    }, [audioDuration, hasBlocks, maxLen]);

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

    function addBlock(trackId, block) {
        setTracks(prev => prev.map(t => {
            if (t.id !== trackId) return t;
            let next = getLen(t.slots);
            return { ...t, slots: { ...t.slots, [next]: block } };
        }));
    }

    function announceConfirmedChord(block) {
        if (!ttsEnabled || !ttsSupported) return;
        const message = getChordAnnouncement(block);
        speakText(message, { voiceURI: selectedVoiceURI });
    }

    function testVoice() {
        if (!ttsEnabled || !ttsSupported) return;
        speakText(getVoiceTestPhrase(selectedVoiceURI), { voiceURI: selectedVoiceURI });
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
    }, [audioTrack, hasBlocks, maxLen, audioDuration, syncStepWithAudioTime]);

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

    return (
        <div
            className={`relative h-screen flex flex-col overflow-hidden ${bigWebcamMode ? 'bg-transparent' : 'bg-[#141414]'} text-[#d7d7d7] ${discoMode ? 'disco-mode' : ''}`}
            style={{
                '--disco-hue-duration': `${discoDuration}ms`,
                '--disco-flash-duration': `${Math.max(220, Math.floor(discoDuration * 0.52))}ms`,
            }}
        >
            {discoMode && <div className="disco-flash-overlay pointer-events-none absolute inset-0 z-40" />}
            <div className="border-b border-[#2f2f2f] bg-[#111111]/95 px-3 py-3">
                <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${shellGlassClass}`}>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-sm font-bold uppercase tracking-[0.24em] text-[#f2f2f2]">BEN</h1>
                            <span className="rounded-full border border-[#3f3f3f] bg-[#222222] px-2 py-1 font-mono text-[10px] text-[#bdbdbd]">
                                120 BPM
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-[#909090]">
                            {studioActivitySummary}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            className="btn btn-sm h-9 min-h-9 rounded-xl border-0 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#111]"
                            style={{
                                backgroundImage:
                                    'linear-gradient(120deg, #ff4d6d 0%, #ff9e3d 22%, #f9f871 42%, #5be37a 60%, #57c7ff 78%, #c180ff 100%)',
                            }}
                            onClick={play}
                            disabled={!hasPlayableContent}
                        >
                            {isPlaying ? 'Stop' : 'Play'}
                        </button>
                        <button
                            className="btn btn-sm h-9 min-h-9 rounded-xl border border-[#5f5f5f] bg-[#3b3b3b] px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#ececec]"
                            onClick={addTrack}
                        >
                            + Track
                        </button>
                        <button
                            className="btn btn-sm h-9 min-h-9 rounded-xl border border-[#4f4f4f] bg-[#242424] px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d5d5d5] hover:bg-[#303030]"
                            onClick={() => setTutorialOpen(true)}
                        >
                            Tutorial
                        </button>
                    </div>
                </div>
            </div>

            <div className="relative z-10 flex flex-1 gap-3 overflow-hidden p-3">
                <div className={`flex w-56 shrink-0 flex-col overflow-hidden rounded-2xl border ${railGlassClass}`}>
                    <div className="flex items-center justify-between border-b border-[#3d3d3d] bg-[#202020] px-3 py-2">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f8f8f]">Tracks</p>
                            <p className="text-xs text-[#d1d1d1]">{tracks.length} lane{tracks.length === 1 ? '' : 's'}</p>
                        </div>
                        <span className="rounded-full border border-[#444] bg-[#262626] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[#b0b0b0]">
                            Arrange
                        </span>
                    </div>
                    {audioTrack && (
                        <div className={`flex h-14 cursor-pointer flex-col justify-center border-b border-[#383838] px-3 py-1 ${
                            selectedTrack === audioTrack.id ? 'bg-[#323232]' : 'hover:bg-[#252525]'
                        }`} onClick={() => setSelectedTrack(selectedTrack === audioTrack.id ? null : audioTrack.id)}>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-[#a0a0a0]" />
                                <span className="truncate text-sm font-semibold text-[#e4e4e4]">{audioTrack.name}</span>
                            </div>
                            <div className="ml-4 mt-0.5 flex items-center gap-2">
                                <span className="text-[11px] text-[#8c8c8c]">MP3 track</span>
                                <button className="btn btn-ghost btn-xs text-[#7b7b7b] hover:text-[#ef5f5f]"
                                    onClick={e => { e.stopPropagation(); removeMp3Track(); }}>
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}
                    {tracks.map((track, idx) => (
                        <div key={track.id}
                            className={`flex h-14 cursor-pointer flex-col justify-center border-b border-[#383838] px-3 py-1 ${
                                selectedTrack === track.id ? 'bg-[#323232]' : 'hover:bg-[#252525]'}`}
                            onClick={() => setSelectedTrack(selectedTrack === track.id ? null : track.id)}>
                            <div className="flex items-center gap-2">
                                <div
                                    className={`h-2 w-2 rounded-full ${track.muted ? 'opacity-30' : ''}`}
                                    style={{ backgroundColor: TRACK_COLORS[idx % TRACK_COLORS.length] }}
                                />
                                <input
                                    className="max-w-[9rem] bg-transparent text-sm font-semibold text-[#e2e2e2] outline-none"
                                    style={{ width: `${Math.max(track.name.length + 1, 7)}ch` }}
                                    value={track.name}
                                    onChange={e => updateTrack(track.id, { name: e.target.value })}
                                    onClick={e => e.stopPropagation()}
                                />
                            </div>
                            <div className="ml-4 mt-0.5 flex items-center gap-1">
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

                <div className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border ${gridGlassClass}`}>
                    {/* beat numbers */}
                    <div className="sticky top-0 z-10 flex h-8 border-b border-[#353535] bg-[#202020]">
                        {Array.from({ length: gridCols }).map((_, i) =>
                            <div key={i} className={`relative flex w-20 shrink-0 items-center border-r border-[#353535] px-2 font-mono text-[11px] ${
                                activeStep === i && isPlaying
                                    ? 'font-bold text-[#f2f2f2] bg-[#d8d8d80d]'
                                    : 'text-[#9b9b9b]'
                            }`}>
                                {activeStep === i && isPlaying && (
                                    <>
                                        <div className="absolute inset-y-0 left-0 w-px bg-[#f4f4f4]/90" />
                                        <div className="absolute left-0 right-0 top-0 h-px bg-[#f4f4f4]/55" />
                                    </>
                                )}
                                {i + 1}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto">
                    {tracks.map((track, tIdx) =>
                        <div key={track.id} className={`flex h-14 border-b border-[#353535] ${
                            selectedTrack === track.id ? 'bg-[#282828]' : 'bg-[#202020]'
                        }`}>
                            {Array.from({ length: gridCols }).map((_, col) => {
                                let block = track.slots[col];
                                let active = activeStep === col;
                                let color = TRACK_COLORS[tIdx % TRACK_COLORS.length];
                                let hovering = dropTarget?.trackId === track.id && dropTarget?.slot === col;
                                let isDragged = dragSrc?.trackId === track.id && dragSrc?.slot === col;

                                return <div key={col}
                                    className={`relative h-full w-20 shrink-0 border-r border-[#343434] p-1 ${
                                        active && isPlaying ? 'bg-[#f3f3f312]' : ''
                                    } ${hovering && dragSrc ? 'bg-[#7d7d7d2d]' : ''}`}
                                    onDragOver={e => { e.preventDefault(); setDropTarget({ trackId: track.id, slot: col }); }}
                                    onDragLeave={() => setDropTarget(null)}
                                    onDrop={() => onDrop(track.id, col)}>

                                    {active && isPlaying && (
                                        <>
                                            <div className="absolute bottom-0 left-0 top-0 w-px bg-[#fafafa]/95" />
                                            <div className="absolute left-0 right-0 top-0 h-px bg-[#fafafa]/40" />
                                            <div className="absolute bottom-1 left-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[#111] bg-[#fafafa] shadow-[0_0_10px_rgba(255,255,255,0.35)]" />
                                        </>
                                    )}

                                    {block && <div draggable
                                        onDragStart={() => setDragSrc({ trackId: track.id, slot: col })}
                                        onDragEnd={() => { setDragSrc(null); setDropTarget(null); }}
                                        className={`group relative flex h-full cursor-grab flex-col justify-center rounded px-2 active:cursor-grabbing ${
                                            track.muted ? 'opacity-20' : active && isPlaying ? 'opacity-100 ring-1 ring-white/40 shadow-[0_0_16px_rgba(255,255,255,0.08)]' : 'opacity-70'
                                        } ${isDragged ? 'opacity-20!' : ''}`}
                                        style={{
                                            backgroundColor: color,
                                        }}
                                    >
                                        <span className="text-xs font-bold leading-tight text-[#111]">
                                            {block.chord.rootNote}{block.chord.quality === 'minor' ? 'm' : ''}
                                        </span>
                                        <span className="text-[10px] leading-tight text-[#111111cc]">Oct {block.chord.octave}</span>
                                        <button
                                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#11111155] text-[11px] font-bold text-[#111] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#11111177] focus:opacity-100"
                                            onClick={() => removeBlock(track.id, col)}
                                        >
                                            ✕
                                        </button>
                                    </div>}
                                </div>;
                            })}
                        </div>
                    )}
                    </div>
                </div>

                <div className={`flex w-[22rem] shrink-0 flex-col gap-3 overflow-y-auto rounded-2xl border p-3 ${utilityGlassClass}`}>
                    <div className={`rounded-2xl border px-3 py-3 ${
                        selectedTrackSummary.ready
                            ? 'border-[#3f4f3d] bg-[#1d241d]'
                            : 'border-[#353535] bg-[#202020]'
                    }`}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f8f8f]">Input Target</p>
                        <p className="mt-1 text-sm font-semibold text-[#efefef]">{selectedTrackSummary.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[#a7a7a7]">{selectedTrackSummary.detail}</p>
                    </div>
                    <div className={`rounded-2xl border px-3 py-3 ${
                        bigWebcamMode ? 'border-[#4066b7] bg-[#132033]/78 backdrop-blur-sm' : 'border-[#353535] bg-[#202020]'
                    }`}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f8f8f]">Webcam Backdrop</p>
                        <p className="mt-1 text-sm font-semibold text-[#efefef]">{backdropModeSummary.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[#a7a7a7]">{backdropModeSummary.detail}</p>
                    </div>

                    {STUDIO_UTILITY_SECTIONS.map((section) => (
                        <details
                            key={section.id}
                            className={`studio-collapsible rounded-2xl border ${
                                bigWebcamMode
                                    ? 'border-white/12 bg-[#161616]/70 backdrop-blur-sm'
                                    : 'border-[#303030] bg-[#1d1d1d]'
                            }`}
                            open={section.defaultOpen}
                        >
                            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d8d8d8]">
                                    {section.title}
                                </span>
                                <span className="studio-collapsible__chevron text-[#7f7f7f]">⌄</span>
                            </summary>
                            <div className="border-t border-[#2d2d2d] px-3 py-3">
                                {section.id === 'input' && (
                                    <div className="space-y-3">
                                        <GestureChordPanel
                                            onAdd={block => selectedTrack && addBlock(selectedTrack, block)}
                                            onConfirmedChord={announceConfirmedChord}
                                            disabled={!selectedTrack}
                                        />
                                        <WebcamComponent
                                            bigMode={bigWebcamMode}
                                            onBigModeChange={setBigWebcamMode}
                                            onPowerChange={setWebcamPoweredOn}
                                        />
                                    </div>
                                )}

                                {section.id === 'media' && (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                className="btn btn-sm h-9 min-h-9 rounded-xl border border-[#4f4f4f] bg-[#242424] px-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#d4d4d4] hover:bg-[#2f2f2f]"
                                                onClick={doExport}
                                                disabled={!hasBlocks}
                                            >
                                                Export MIDI
                                            </button>
                                            <button
                                                className="btn btn-sm h-9 min-h-9 rounded-xl border border-[#4f4f4f] bg-[#242424] px-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#d4d4d4] hover:bg-[#2f2f2f]"
                                                onClick={() => fileInputRef.current.click()}
                                            >
                                                Import MIDI
                                            </button>
                                            <button
                                                className="btn btn-sm col-span-2 h-9 min-h-9 rounded-xl border border-[#4f4f4f] bg-[#242424] px-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#d4d4d4] hover:bg-[#2f2f2f]"
                                                onClick={() => mp3InputRef.current.click()}
                                            >
                                                Upload MP3
                                            </button>
                                        </div>
                                        <input ref={fileInputRef} type="file" accept=".mid,.midi" className="hidden" onChange={doImport} />
                                        <input ref={mp3InputRef} type="file" accept=".mp3,audio/mpeg" className="hidden" onChange={onMp3Upload} />

                                        {audioTrack ? (
                                            <div className="rounded-xl border border-[#3a3a3a] bg-[#181818] p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-[#efefef]">{audioTrack.name}</p>
                                                        <p className="text-xs text-[#9d9d9d]">
                                                            {formatClock(audioCurrentTime)} / {formatClock(audioDuration)}
                                                        </p>
                                                    </div>
                                                    <button
                                                        className="btn btn-ghost btn-xs text-[#8b8b8b] hover:text-[#ef5f5f]"
                                                        onClick={removeMp3Track}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs leading-5 text-[#8d8d8d]">
                                                Import or export MIDI here, and keep an MP3 reference track tucked away until you need it.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {section.id === 'voice' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#353535] bg-[#181818] px-3 py-2">
                                            <span className="text-xs font-semibold text-[#d6d6d6]">{getTtsStatusLabel(ttsEnabled, ttsSupported)}</span>
                                            <button
                                                className={`btn btn-sm h-8 min-h-8 rounded-xl border px-3 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                                                    ttsEnabled && ttsSupported
                                                        ? 'border-[#6d6d6d] bg-[#343434] text-[#f0f0f0]'
                                                        : 'border-[#4d4d4d] bg-[#232323] text-[#b6b6b6]'
                                                }`}
                                                onClick={() => setTtsEnabled((enabled) => !enabled)}
                                                disabled={!ttsSupported}
                                            >
                                                {ttsEnabled ? 'Disable' : 'Enable'}
                                            </button>
                                        </div>
                                        <label className="flex flex-col gap-1">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a8a8a8]">Voice</span>
                                            <select
                                                className="select select-sm h-9 min-h-9 w-full rounded-xl border border-[#4d4d4d] bg-[#181818] text-xs text-[#dfdfdf]"
                                                value={selectedVoiceURI}
                                                onChange={(e) => setSelectedVoiceURI(e.target.value)}
                                                disabled={!ttsSupported || availableVoices.length === 0}
                                            >
                                                {getVoiceOptions(availableVoices).map((voice) => (
                                                    <option key={voice.value} value={voice.value}>
                                                        {voice.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <button
                                            className="btn btn-sm h-9 min-h-9 rounded-xl border border-[#4f4f4f] bg-[#242424] px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d5d5d5]"
                                            onClick={testVoice}
                                            disabled={!ttsEnabled || !ttsSupported}
                                        >
                                            Test Voice
                                        </button>
                                    </div>
                                )}

                                {section.id === 'fx' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#353535] bg-[#181818] px-3 py-2">
                                            <div>
                                                <p className="text-xs font-semibold text-[#dedede]">Disco Mode</p>
                                                <p className="text-[11px] text-[#8b8b8b]">Purely visual. Keeps the sequencer focused when off.</p>
                                            </div>
                                            <button
                                                className={`btn btn-sm h-8 min-h-8 rounded-xl border px-3 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                                                    discoMode
                                                        ? 'border-[#8c8c8c] bg-[#5e5e5e] text-[#fff]'
                                                        : 'border-[#4d4d4d] bg-[#232323] text-[#bfbfbf]'
                                                }`}
                                                onClick={() => setDiscoMode((v) => !v)}
                                            >
                                                {discoMode ? 'On' : 'Off'}
                                            </button>
                                        </div>
                                        <label className="flex flex-col gap-2 rounded-xl border border-[#353535] bg-[#181818] px-3 py-3">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a8a8a8]">Animation Speed</span>
                                            <input
                                                type="range"
                                                min={450}
                                                max={2200}
                                                step={50}
                                                value={discoSpeed}
                                                onChange={(e) => setDiscoSpeed(Number(e.target.value))}
                                                className="range range-xs [--range-bg:#101010] [--range-fill:#8d8d8d] [--range-thumb:#d6d6d6]"
                                                aria-label="Disco mode speed"
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                        </details>
                    ))}
                </div>
            </div>

            <div className="border-t border-[#2f2f2f] bg-[#111111]/95 px-3 py-3">
                <div className={`relative z-10 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${shellGlassClass}`}>
                    {audioTrack && (
                        <div className="flex min-w-[16rem] flex-1 items-center gap-3">
                            <audio ref={audioRef} src={audioTrack.url} preload="metadata" className="hidden" />
                            <span className="shrink-0 text-[11px] uppercase tracking-[0.08em] text-[#9f9f9f]">Track</span>
                            <span className="shrink-0 rounded-full border border-[#464646] bg-[#202020] px-2 py-1 font-mono text-[11px] text-[#c7c7c7]">
                                {formatClock(audioCurrentTime)} / {formatClock(audioDuration)}
                            </span>
                            <input
                                type="range"
                                min={0}
                                max={scrubMax}
                                step={0.01}
                                value={Math.min(audioCurrentTime, scrubMax)}
                                onChange={onAudioScrub}
                                className="range range-xs min-w-0 flex-1 [--range-bg:#1b1b1b] [--range-fill:#8f8f8f] [--range-thumb:#d6d6d6]"
                                aria-label="Track timeline scrubber"
                            />
                        </div>
                    )}
                    {selectedMidiTrack ? (
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs text-[#b2b2b2]">
                                Adding to: <strong>{selectedMidiTrack.name}</strong>
                            </span>
                            <ChordForm onAdd={block => addBlock(selectedTrack, block)} compact />
                        </div>
                    ) : (
                        <span className="text-xs text-[#868686]">Click a track to add chords</span>
                    )}
                </div>
            </div>
            <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
        </div>
    );
}

export default StudioPage;
