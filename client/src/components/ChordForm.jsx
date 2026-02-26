import { useState } from 'react';
import Chord from '../models/Chord';
import Block from '../models/Block';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [1, 2, 3, 4, 5, 6, 7];
const QUALITIES = ['major', 'minor'];
const INSTRUMENTS = ['keys', 'pad', 'pluck', 'organ'];

export default function ChordForm({ onAdd }) {
    const [rootNote, setRootNote] = useState('C');
    const [octave, setOctave] = useState(4);
    const [quality, setQuality] = useState('major');
    const [instrument, setInstrument] = useState('keys');

    function handleAdd() {
        const chord = new Chord(rootNote, octave, quality);
        const block = new Block(chord, null, instrument);
        onAdd(block);
    }

    return (
        <div className="card bg-base-100 shadow-md p-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                    <label className="label py-1">
                        <span className="label-text text-xs font-semibold uppercase tracking-wide">Root</span>
                    </label>
                    <select className="select select-bordered select-sm" value={rootNote} onChange={e => setRootNote(e.target.value)}>
                        {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </div>
                <div className="form-control">
                    <label className="label py-1">
                        <span className="label-text text-xs font-semibold uppercase tracking-wide">Octave</span>
                    </label>
                    <select className="select select-bordered select-sm" value={octave} onChange={e => setOctave(Number(e.target.value))}>
                        {OCTAVES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="form-control">
                    <label className="label py-1">
                        <span className="label-text text-xs font-semibold uppercase tracking-wide">Quality</span>
                    </label>
                    <select className="select select-bordered select-sm" value={quality} onChange={e => setQuality(e.target.value)}>
                        {QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                </div>
                <div className="form-control">
                    <label className="label py-1">
                        <span className="label-text text-xs font-semibold uppercase tracking-wide">Instrument</span>
                    </label>
                    <select className="select select-bordered select-sm" value={instrument} onChange={e => setInstrument(e.target.value)}>
                        {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
            </div>
            <button className="btn btn-primary btn-sm mt-3 w-full" onClick={handleAdd}>Add Chord</button>
        </div>
    );
}
