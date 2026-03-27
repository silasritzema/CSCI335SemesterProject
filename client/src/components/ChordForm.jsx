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
                <select className="select select-bordered select-sm" value={rootNote} onChange={e => setRootNote(e.target.value)}>
                    {NOTES.map(n => <option key={n}>{n}</option>)}
                </select>
                <select className="select select-bordered select-sm" value={octave} onChange={e => setOctave(+e.target.value)}>
                    {OCTAVES.map(o => <option key={o}>{o}</option>)}
                </select>
                <select className="select select-bordered select-sm" value={quality} onChange={e => setQuality(e.target.value)}>
                    {QUALITIES.map(q => <option key={q}>{q}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleAdd}>+ Add</button>
            </div>
        );
    }

    return (
        <div className="card bg-base-100 shadow-md p-4">
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide">Root</label>
                    <select className="select select-bordered select-sm w-full mt-1" value={rootNote} onChange={e => setRootNote(e.target.value)}>
                        {NOTES.map(n => <option key={n}>{n}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide">Octave</label>
                    <select className="select select-bordered select-sm w-full mt-1" value={octave} onChange={e => setOctave(+e.target.value)}>
                        {OCTAVES.map(o => <option key={o}>{o}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide">Quality</label>
                    <select className="select select-bordered select-sm w-full mt-1" value={quality} onChange={e => setQuality(e.target.value)}>
                        {QUALITIES.map(q => <option key={q}>{q}</option>)}
                    </select>
                </div>
            </div>
            <button className="btn btn-primary btn-sm mt-3 w-full" onClick={handleAdd}>Add Chord</button>
        </div>
    );
}
