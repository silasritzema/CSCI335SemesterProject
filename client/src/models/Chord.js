const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const FLATS_TO_SHARPS = {
    'Bb': 'A#',
    'Eb': 'D#',
    'Ab': 'G#',
    'Db': 'C#',
    'Gb': 'F#',
};

const INTERVALS = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
};

class Chord {
    constructor(rootNote, octave, quality = 'major') {
        this.rootNote = rootNote;
        this.octave = octave;
        this.quality = quality;
    }

    toNotes() {
        const root = FLATS_TO_SHARPS[this.rootNote] || this.rootNote;
        const rootIndex = NOTE_ORDER.indexOf(root);
        const intervals = INTERVALS[this.quality];

        return intervals.map(interval => {
            const noteIndex = (rootIndex + interval) % 12;
            const octaveOffset = Math.floor((rootIndex + interval) / 12);
            return `${NOTE_ORDER[noteIndex]}${parseInt(this.octave) + octaveOffset}`;
        });
    }

    toString() {
        return `${this.rootNote}${this.octave}${this.quality}`;
    }
}

export default Chord;