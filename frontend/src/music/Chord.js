class Chord {
    constructor(rootNote, octave) {
        this.rootNote = rootNote;
        this.octave = octave;
    }

    build() {
        return `${this.rootNote}${this.octave}`;
    }
}

export default Chord;