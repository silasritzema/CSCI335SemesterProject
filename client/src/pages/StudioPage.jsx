import { useState, useRef } from 'react';
import { playChord } from '../audio/audioEngine';
import { exportMidiMultiTrack, importMidiMultiTrack } from '../audio/midiExport';
import ChordForm from '../components/ChordForm';

const INSTRUMENTS = ['piano', 'guitar', 'bass', 'drums'];
const TRACK_COLORS = ['bg-success', 'bg-info', 'bg-secondary', 'bg-warning', 'bg-error', 'bg-accent'];

function getLen(slots) {
    const keys = Object.keys(slots).map(Number);
    return keys.length === 0 ? 0 : Math.max(...keys) + 1;
}

function StudioPage() {
    const [tracks, setTracks] = useState([
        { id: crypto.randomUUID(), name: 'Track 1', instrument: 'piano', muted: false, slots: {} }
    ]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeStep, setActiveStep] = useState(null);
    const [selectedTrack, setSelectedTrack] = useState(null);
    const [dragSrc, setDragSrc] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const playbackRef = useRef(null);
    const tracksRef = useRef(tracks);
    const fileInputRef = useRef(null);
    tracksRef.current = tracks;

    const maxLen = Math.max(...tracks.map(t => getLen(t.slots)), 0);
    const gridCols = maxLen + 1;
    const hasBlocks = maxLen > 0;

    function stopPlayback() {
        clearInterval(playbackRef.current);
        playbackRef.current = null;
        setIsPlaying(false);
        setActiveStep(null);
    }

    function addTrack() {
        let num = tracks.length + 1;
        let inst = INSTRUMENTS[tracks.length % INSTRUMENTS.length];
        setTracks([...tracks, { id: crypto.randomUUID(), name: `Track ${num}`, instrument: inst, muted: false, slots: {} }]);
    }

    function removeTrack(id) {
        setTracks(tracks.filter(t => t.id !== id));
        if (selectedTrack === id) setSelectedTrack(null);
    }

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
        if (playbackRef.current) { stopPlayback(); return; }
        if (!hasBlocks) return;

        let step = 0;
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
        <div className="h-screen flex flex-col bg-base-300 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-base-200 border-b border-base-content/10">
                <h1 className="font-bold text-lg mr-4">Chord Studio</h1>
                <button className={`btn btn-sm ${isPlaying ? 'btn-error' : 'btn-success'}`}
                    onClick={play} disabled={!hasBlocks}>
                    {isPlaying ? 'Stop' : 'Play'}
                </button>
                <span className="text-xs opacity-50 font-mono ml-2">120 BPM</span>
                <div className="flex-1" />
                <button className="btn btn-sm btn-ghost" onClick={doExport} disabled={!hasBlocks}>Export MIDI</button>
                <button className="btn btn-sm btn-ghost" onClick={() => fileInputRef.current.click()}>Import MIDI</button>
                <input ref={fileInputRef} type="file" accept=".mid,.midi" className="hidden" onChange={doImport} />
                <button className="btn btn-sm btn-outline" onClick={addTrack}>+ Track</button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-48 shrink-0 bg-base-200 border-r border-base-content/10 overflow-y-auto">
                    <div className="h-7 border-b border-base-content/10" />
                    {tracks.map((track, idx) => (
                        <div key={track.id}
                            className={`h-16 border-b border-base-content/10 px-3 py-1 flex flex-col justify-center cursor-pointer ${
                                selectedTrack === track.id ? 'bg-base-300' : 'hover:bg-base-300/50'}`}
                            onClick={() => setSelectedTrack(selectedTrack === track.id ? null : track.id)}>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${TRACK_COLORS[idx % TRACK_COLORS.length]} ${track.muted ? 'opacity-20' : ''}`} />
                                <input className="bg-transparent text-sm font-semibold w-full outline-none"
                                    value={track.name}
                                    onChange={e => updateTrack(track.id, { name: e.target.value })}
                                    onClick={e => e.stopPropagation()} />
                            </div>
                            <div className="flex items-center gap-1 ml-4 mt-0.5">
                                <select className="select select-ghost select-xs text-xs opacity-60 p-0"
                                    value={track.instrument}
                                    onChange={e => updateTrack(track.id, { instrument: e.target.value })}
                                    onClick={e => e.stopPropagation()}>
                                    {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                                </select>
                                <button className={`btn btn-ghost btn-xs ${track.muted ? 'text-error' : 'opacity-40'}`}
                                    onClick={e => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }); }}>
                                    M
                                </button>
                                {tracks.length > 1 &&
                                    <button className="btn btn-ghost btn-xs opacity-30 hover:opacity-100 hover:text-error"
                                        onClick={e => { e.stopPropagation(); removeTrack(track.id); }}>
                                        ✕
                                    </button>}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex-1 overflow-auto">
                    {/* beat numbers */}
                    <div className="flex h-7 border-b border-base-content/10 sticky top-0 bg-base-300 z-10">
                        {Array.from({ length: gridCols }).map((_, i) =>
                            <div key={i} className={`w-24 shrink-0 text-xs font-mono px-2 flex items-center border-r border-base-content/5 ${
                                activeStep === i ? 'text-primary font-bold' : 'opacity-30'}`}>
                                {i + 1}
                            </div>
                        )}
                    </div>

                    {tracks.map((track, tIdx) =>
                        <div key={track.id} className={`flex h-16 border-b border-base-content/10 ${
                            selectedTrack === track.id ? 'bg-base-content/5' : ''}`}>
                            {Array.from({ length: gridCols }).map((_, col) => {
                                let block = track.slots[col];
                                let active = activeStep === col;
                                let color = TRACK_COLORS[tIdx % TRACK_COLORS.length];
                                let hovering = dropTarget?.trackId === track.id && dropTarget?.slot === col;
                                let isDragged = dragSrc?.trackId === track.id && dragSrc?.slot === col;

                                return <div key={col}
                                    className={`w-24 shrink-0 h-full border-r border-base-content/5 p-1 relative ${
                                        active && isPlaying ? 'bg-primary/10' : ''} ${hovering && dragSrc ? 'bg-primary/20' : ''}`}
                                    onDragOver={e => { e.preventDefault(); setDropTarget({ trackId: track.id, slot: col }); }}
                                    onDragLeave={() => setDropTarget(null)}
                                    onDrop={() => onDrop(track.id, col)}>

                                    {active && isPlaying && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}

                                    {block && <div draggable
                                        onDragStart={() => setDragSrc({ trackId: track.id, slot: col })}
                                        onDragEnd={() => { setDragSrc(null); setDropTarget(null); }}
                                        className={`h-full rounded ${color} ${
                                            track.muted ? 'opacity-20' : active && isPlaying ? 'opacity-90' : 'opacity-40'
                                        } ${isDragged ? 'opacity-20!' : ''} flex flex-col justify-center px-2 group relative cursor-grab active:cursor-grabbing`}>
                                        <span className="text-sm font-bold text-base-100 leading-tight">
                                            {block.chord.rootNote}{block.chord.quality === 'minor' ? 'm' : ''}
                                        </span>
                                        <span className="text-xs text-base-100/70 leading-tight">Oct {block.chord.octave}</span>
                                        <button className="absolute top-0 right-0 btn btn-ghost btn-xs opacity-0 group-hover:opacity-80 text-base-100"
                                            onClick={() => removeBlock(track.id, col)}>✕</button>
                                    </div>}
                                </div>;
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="shrink-0 bg-base-200 border-t border-base-content/10 px-4 py-2 flex items-center gap-3">
                {selectedTrack ? <>
                    <span className="text-xs opacity-50">
                        Adding to: <strong>{tracks.find(t => t.id === selectedTrack)?.name}</strong>
                    </span>
                    <ChordForm onAdd={block => addBlock(selectedTrack, block)} compact />
                </> : <span className="text-xs opacity-30">Click a track to add chords</span>}
            </div>
        </div>
    );
}

export default StudioPage;
