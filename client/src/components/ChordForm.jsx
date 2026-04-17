import { useState } from 'react';
import Chord from '../models/Chord';
import Block from '../models/Block';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [1, 2, 3, 4, 5, 6, 7];
const QUALITIES = ['major', 'minor'];

export default function ChordForm({ onAdd, compact = false }) {
    const [rootNote, setRootNote] = useState('C');
    const [octave, setOctave] = useState(4);
    const [quality, setQuality] = useState('major');

    function handleAdd() {
        onAdd(new Block(new Chord(rootNote, octave, quality)));
    }

    if (compact) {
        return (
            <div className="flex items-center gap-2">
                <select
                    className="select select-sm h-8 min-h-8 rounded border border-[#5a5a5a] bg-[#1f1f1f] text-xs font-semibold text-[#dedede]"
                    value={rootNote}
                    onChange={e => setRootNote(e.target.value)}
                >
                    {NOTES.map(n => <option key={n}>{n}</option>)}
                </select>
                <select
                    className="select select-sm h-8 min-h-8 rounded border border-[#5a5a5a] bg-[#1f1f1f] text-xs font-semibold text-[#dedede]"
                    value={octave}
                    onChange={e => setOctave(+e.target.value)}
                >
                    {OCTAVES.map(o => <option key={o}>{o}</option>)}
                </select>
                <select
                    className="select select-sm h-8 min-h-8 rounded border border-[#5a5a5a] bg-[#1f1f1f] text-xs font-semibold text-[#dedede]"
                    value={quality}
                    onChange={e => setQuality(e.target.value)}
                >
                    {QUALITIES.map(q => <option key={q}>{q}</option>)}
                </select>
                <button
                    className="btn btn-sm h-8 min-h-8 rounded border border-[#5f5f5f] bg-[#4a4a4a] px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#e6e6e6]"
                    onClick={handleAdd}
                >
                    + Add
                </button>
            </div>
        );
    }

    return (
        <div className="card border border-[#525252] bg-[#232323] p-4">
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#b1b1b1]">Root</label>
                    <select className="select select-sm mt-1 w-full rounded border border-[#5a5a5a] bg-[#1f1f1f] text-xs font-semibold text-[#dedede]" value={rootNote} onChange={e => setRootNote(e.target.value)}>
                        {NOTES.map(n => <option key={n}>{n}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#b1b1b1]">Octave</label>
                    <select className="select select-sm mt-1 w-full rounded border border-[#5a5a5a] bg-[#1f1f1f] text-xs font-semibold text-[#dedede]" value={octave} onChange={e => setOctave(+e.target.value)}>
                        {OCTAVES.map(o => <option key={o}>{o}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#b1b1b1]">Quality</label>
                    <select className="select select-sm mt-1 w-full rounded border border-[#5a5a5a] bg-[#1f1f1f] text-xs font-semibold text-[#dedede]" value={quality} onChange={e => setQuality(e.target.value)}>
                        {QUALITIES.map(q => <option key={q}>{q}</option>)}
                    </select>
                </div>
            </div>
            <button className="btn btn-sm mt-3 w-full rounded border border-[#5f5f5f] bg-[#4a4a4a] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#e6e6e6]" onClick={handleAdd}>
                Add Chord
            </button>
        </div>
    );
}
