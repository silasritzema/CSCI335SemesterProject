class Block {
    constructor(chord) {
        this.chord = chord;
        this.id = crypto.randomUUID();
    }

    display() {
        this.chord.build();
    }
}

export default Block;