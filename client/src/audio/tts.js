export function getChordAnnouncement(block) {
    const chord = block?.chord;
    if (!chord?.rootNote || !chord?.quality) return '';
    return `${chord.rootNote} ${chord.quality} added`;
}

export function isTtsSupported(synth = globalThis.speechSynthesis, UtteranceCtor = globalThis.SpeechSynthesisUtterance) {
    return Boolean(synth && UtteranceCtor);
}

export function getTtsStatusLabel(enabled, supported) {
    if (!supported) return 'Voice: Unsupported';
    return enabled ? 'Voice: On' : 'Voice: Off';
}

export function speakText(text, synth = globalThis.speechSynthesis, UtteranceCtor = globalThis.SpeechSynthesisUtterance) {
    if (!text || !synth || !UtteranceCtor) return;

    try {
        synth.cancel?.();
        const utterance = new UtteranceCtor(text);
        synth.speak?.(utterance);
    } catch {
        // Speech is a progressive enhancement; fail silently when unavailable.
    }
}
