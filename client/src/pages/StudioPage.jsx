import { useState, useRef } from 'react';
import { playChord } from '../audio/audioEngine';
import ChordForm from '../components/ChordForm';
import ChordCard from '../components/ChordCard';

function StudioPage() {
    const [blocks, setBlocks] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeIndex, setActiveIndex] = useState(null);
    const playbackRef = useRef(null);
    const blocksRef = useRef(blocks);
    blocksRef.current = blocks;

    function stopPlayback() {
        clearInterval(playbackRef.current);
        playbackRef.current = null;
        setIsPlaying(false);
        setActiveIndex(null);
    }

    function addBlock(block) {
        setBlocks([...blocks, block]);
    }

    function removeBlock(index) {
        setBlocks(blocks.filter((_, i) => i !== index));
        if (activeIndex === index) setActiveIndex(null);
    }

    function playProgression() {
        if (playbackRef.current) {
            stopPlayback();
            return;
        }

        if (blocks.length === 0) return;

        let current = 0;
        setIsPlaying(true);

        function playNext() {
            const currentBlocks = blocksRef.current;
            if (currentBlocks.length === 0) {
                stopPlayback();
                return;
            }
            current = current % currentBlocks.length;
            const block = currentBlocks[current];
            setActiveIndex(current);
            playChord(block.toNotes(), block.chord.rootNote, block.chord.octave, block.instrument);
            current = (current + 1) % currentBlocks.length;
        }

        playNext();
        playbackRef.current = setInterval(playNext, 1000);
    }

    return (
        <div className="min-h-screen bg-base-300 p-6">
            <h1 className="text-2xl font-bold mb-4">Chord Builder</h1>

            <div className="flex flex-wrap gap-2 mb-6 items-center">
                <ChordForm onAdd={addBlock} />
                <button className="btn btn-success" onClick={playProgression} disabled={blocks.length === 0}>
                    {isPlaying ? 'Stop' : 'Play'}
                </button>
            </div>

            <div className="flex flex-wrap gap-3">
                {blocks.map((block, i) => (
                    <ChordCard
                        key={block.id}
                        block={block}
                        active={activeIndex === i}
                        onRemove={() => removeBlock(i)}
                    />
                ))}
                {blocks.length === 0 && (
                    <p className="text-base-content/50">No chords yet. Add some above.</p>
                )}
            </div>
        </div>
    );
}

export default StudioPage;
