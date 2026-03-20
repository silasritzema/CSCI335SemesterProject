import { PolySynth, Synth, start } from 'tone';

const instruments = {
    keys: new PolySynth(Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.3 }
    }).toDestination(),

    pad: new PolySynth(Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.4, decay: 0.5, sustain: 0.8, release: 1.2 }
    }).toDestination(),

    pluck: new PolySynth(Synth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0.05, release: 0.2 }
    }).toDestination(),

    organ: new PolySynth(Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.4 }
    }).toDestination(),
};

export async function playChord(notes, rootNote, octave, instrument = 'keys') {
    await start();
    const synth = instruments[instrument] || instruments.keys;
    synth.releaseAll();
    synth.triggerAttackRelease(notes, '2n');
}
