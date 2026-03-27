import { Midi } from '@tonejs/midi';
import Chord from '../models/Chord';
import Block from '../models/Block';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const INSTRUMENT_NAMES = ['piano', 'guitar', 'bass', 'drums'];
const BPM = 120;
const BEAT_DURATION = 60 / BPM;

export function exportMidiMultiTrack(tracks) {
    const midi = new Midi();
    midi.header.setTempo(BPM);

    for (const track of tracks) {
        if (track.blocks.length === 0) continue;
        const t = midi.addTrack();
        t.name = track.name;

        for (let i = 0; i < track.blocks.length; i++) {
            for (const note of track.blocks[i].toNotes()) {
                t.addNote({ name: note, time: i * BEAT_DURATION, duration: BEAT_DURATION, velocity: 0.8 });
            }
        }
    }

    const blob = new Blob([midi.toArray()], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'progression.mid';
    a.click();
    URL.revokeObjectURL(url);
}

// figures out chord quality from a set of note names
function detectChord(noteNames) {
    const parsed = noteNames.map(n => {
        const match = n.match(/^([A-G]#?)(\d+)$/);
        if (!match) return null;
        return {
            name: match[1],
            octave: parseInt(match[2]),
            midi: NOTE_NAMES.indexOf(match[1]) + (parseInt(match[2]) + 1) * 12
        };
    }).filter(Boolean).sort((a, b) => a.midi - b.midi);

    if (parsed.length === 0) return null;

    const root = parsed[0];
    const intervals = parsed.map(p => (p.midi - root.midi) % 12);
    const quality = intervals.includes(3) && intervals.includes(7) ? 'minor' : 'major';

    return new Chord(root.name, root.octave, quality);
}

export function importMidiMultiTrack(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const midi = new Midi(reader.result);
                const tempo = midi.header.tempos[0]?.bpm;
                const beatLen = tempo ? 60 / tempo : BEAT_DURATION;

                const noteTracks = midi.tracks.filter(t => t.notes.length > 0);
                if (noteTracks.length === 0) {
                    resolve([{ id: crypto.randomUUID(), name: 'Track 1', instrument: 'piano', blocks: [] }]);
                    return;
                }

                const tracks = noteTracks.map((midiTrack, i) => {
                    // group notes that land on the same beat into chords
                    const chords = new Map();
                    for (const note of midiTrack.notes) {
                        const beat = Math.round(note.time / beatLen);
                        if (!chords.has(beat)) chords.set(beat, []);
                        const octave = Math.max(0, Math.floor(note.midi / 12) - 1);
                        chords.get(beat).push(`${NOTE_NAMES[note.midi % 12]}${octave}`);
                    }

                    const blocks = [...chords.keys()].sort((a, b) => a - b).map(beat => {
                        const chord = detectChord([...new Set(chords.get(beat))]);
                        return chord ? new Block(chord) : null;
                    }).filter(Boolean);

                    return {
                        id: crypto.randomUUID(),
                        name: midiTrack.name || `Track ${i + 1}`,
                        instrument: INSTRUMENT_NAMES[i % INSTRUMENT_NAMES.length],
                        blocks,
                    };
                }).filter(t => t.blocks.length > 0);

                if (tracks.length === 0) {
                    tracks.push({ id: crypto.randomUUID(), name: 'Track 1', instrument: 'piano', blocks: [] });
                }
                resolve(tracks);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}
