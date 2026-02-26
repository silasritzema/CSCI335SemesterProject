class Block {
    constructor(chord, gesture = null, instrument = 'keys') {
        this.chord = chord;
        this.gesture = gesture;
        this.instrument = instrument;
        this.id = crypto.randomUUID();
    }

    toNotes() {
        return this.chord.toNotes();
    }

    display() {
        return this.chord.toString();
    }
}

export default Block;