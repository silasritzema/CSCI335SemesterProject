import { useState } from 'react';
import Chord from '../music/Chord';
import Block from '../music/Block';

// Daniel Kao

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [1, 2, 3, 4, 5, 6, 7];
const SLOTS = 4;

function DAWPage() {
    const [blocks, setBlocks] = useState(new Array(SLOTS).fill(null)); // Initialize an empty array of size 4
    const [rootNote, setRootNote] = useState('C'); // Track the note being used, default is C
    const [octave, setOctave] = useState(4); // Track octave being used, default is 4

    function addChord() {
        const emptyIndex = blocks.indexOf(null); // Finds the first empty index in the array
        if (emptyIndex === -1) return; // If the array is full, return
        const chord = new Chord(rootNote, octave); // If we get here, we know the array has an open slot
        const block = new Block(chord); // Use the chord we created above to create a new block
        const updated = [...blocks]; // Create a duplicate array
        updated[emptyIndex] = block; // Set the element at the empty index to the new block
        setBlocks(updated); // Update the array
    }

    function removeBlock(index) { // Function to remove the block at a certain index
        const updated = [...blocks]; // Create a duplicate array
        updated[index] = null; // Set the element at given index to null in the duplicate array
        setBlocks(updated); // Update the array
    }

    const filledCount = blocks.filter(b => b !== null).length; // Creates a new array for all the elements that are NOT null, and then gets length of that array

    return ( // Build page and return it
        <div className="min-h-screen bg-base-300 p-6">
            <h1 className="text-2xl font-bold mb-4">Chord Builder</h1>

            {/* Controls */}
            <div className="flex gap-2 mb-6">
                <select className="select select-bordered" value={rootNote} onChange={e => setRootNote(e.target.value)}>
                    {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <select className="select select-bordered" value={octave} onChange={e => setOctave(Number(e.target.value))}>
                    {OCTAVES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <button className="btn btn-primary" onClick={addChord} disabled={filledCount >= SLOTS}>Add Chord</button>
            </div>

            {/* Chord grid */}
            <div className="grid grid-cols-4 gap-3">
                {blocks.map((block, i) => (
                    block ? (
                        <div key={block.id} className="card bg-base-100 p-4">
                            <div className="flex justify-between items-center">
                                <span className="font-bold">{block.display()}</span>
                                <button className="btn btn-sm btn-error" onClick={() => removeBlock(i)}>X</button>
                            </div>
                        </div>
                    ) : (
                        <div key={`empty-${i}`} className="card bg-base-100 p-4 opacity-30 text-center">
                            Empty
                        </div>
                    )
                ))}
            </div>
        </div>
    );
}

export default DAWPage;