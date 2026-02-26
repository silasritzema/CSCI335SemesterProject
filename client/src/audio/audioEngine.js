import { PolySynth, Synth, MonoSynth, Player, start } from 'tone';

let samplePlayer = null;

const synth = new PolySynth(Synth, {
    oscillator: { type: 'triangle' },
    envelope: {
        attack: 0.05,
        decay: 0.3,
        sustain: 0.4,
        release: 0.3  // was 1.5, much shorter now
    }
}).toDestination();

const bass = new MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: {
        attack: 0.05,
        decay: 0.2,
        sustain: 0.8,
        release: 0.3
    },
    filterEnvelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0.5,
        release: 0.5,
        baseFrequency: 200,
        octaves: 2
    }
}).toDestination();

export async function playChord(notes, rootNote, octave) {
    await start();
    synth.releaseAll();
    synth.triggerAttackRelease(notes, '2n');
    const bassOctave = octave - 1 < 1 ? 1 : octave - 1;
    bass.triggerAttackRelease(`${rootNote}${bassOctave}`, '2n');
}

export function loadSample(file) {
    const url = URL.createObjectURL(file);
    samplePlayer = new Player(url).toDestination();
}

export async function playSample() {
    if (!samplePlayer) return;
    await start();
    samplePlayer.start();
}