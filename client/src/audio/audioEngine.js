import { Sampler, start } from 'tone';

// sample URLs
const PIANO_URL = 'https://tonejs.github.io/audio/salamander/';
const GUITAR_URL = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3/';
const BASS_URL = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/electric_bass_finger-mp3/';
const DRUMS_URL = 'https://tonejs.github.io/audio/drum-samples/acoustic-kit/';

let samplers = {};
let loading = {};

function load(name) {
    if (samplers[name]) return Promise.resolve(samplers[name]);
    if (loading[name]) return loading[name];

    let url, notes;
    switch (name) {
        case 'piano':
            url = PIANO_URL;
            notes = {
                'A1': 'A1.mp3', 'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3', 'A5': 'A5.mp3', 'A6': 'A6.mp3',
                'C1': 'C1.mp3', 'C2': 'C2.mp3', 'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C6': 'C6.mp3',
                'D#1': 'Ds1.mp3', 'D#2': 'Ds2.mp3', 'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3', 'D#5': 'Ds5.mp3',
                'F#1': 'Fs1.mp3', 'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3', 'F#5': 'Fs5.mp3',
            };
            break;
        case 'guitar':
            url = GUITAR_URL;
            notes = {
                'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3',
                'A3': 'A3.mp3', 'A4': 'A4.mp3',
                'Ab3': 'Ab3.mp3', 'Ab4': 'Ab4.mp3',
                'Eb3': 'Eb3.mp3', 'Eb4': 'Eb4.mp3',
                'E3': 'E3.mp3', 'E4': 'E4.mp3',
            };
            break;
        case 'bass':
            url = BASS_URL;
            notes = {
                'C1': 'C1.mp3', 'C2': 'C2.mp3', 'C3': 'C3.mp3',
                'A1': 'A1.mp3', 'A2': 'A2.mp3',
                'Ab1': 'Ab1.mp3', 'Ab2': 'Ab2.mp3',
                'Eb1': 'Eb1.mp3', 'Eb2': 'Eb2.mp3',
                'E1': 'E1.mp3', 'E2': 'E2.mp3',
            };
            break;
        case 'drums':
            url = DRUMS_URL;
            notes = { 'C3': 'kick.mp3', 'D3': 'snare.mp3', 'F#3': 'hihat.mp3', 'A3': 'tom1.mp3', 'B3': 'tom2.mp3', 'C4': 'tom3.mp3' };
            break;
        default:
            return load('piano');
    }

    loading[name] = new Promise(resolve => {
        let sampler = new Sampler({ urls: notes, baseUrl: url, onload: () => {
            samplers[name] = sampler;
            delete loading[name];
            resolve(sampler);
        }}).toDestination();
    });
    return loading[name];
}

export async function playChord(notes, rootNote, octave, instrument = 'piano') {
    await start();
    let sampler = await load(instrument);
    sampler.releaseAll();
    sampler.triggerAttackRelease(notes, '2n');
}
