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

export function getVoiceOptions(voices = []) {
    return voices.map((voice) => ({
        label: `${voice.name}${voice.lang ? ` (${voice.lang})` : ''}`,
        value: JSON.stringify({
            voiceURI: voice.voiceURI || '',
            name: voice.name || '',
            lang: voice.lang || '',
        }),
    }));
}

export function parseSelectedVoice(value = '') {
    if (!value) return null;

    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') return parsed;
    } catch {
        // Support older plain-string values from the initial implementation.
    }

    return { voiceURI: value, name: value, lang: '' };
}

export function findSelectedVoice(voices = [], selectedVoiceValue = '') {
    const selected = parseSelectedVoice(selectedVoiceValue);
    if (!selected) return null;

    return voices.find((voice) => (
        (selected.voiceURI && voice.voiceURI === selected.voiceURI)
        || (selected.name && voice.name === selected.name && (!selected.lang || voice.lang === selected.lang))
        || (selected.name && voice.name === selected.name)
    )) ?? null;
}

export function getVoiceTestPhrase(selectedVoiceValue = '') {
    const selected = parseSelectedVoice(selectedVoiceValue);
    const lang = selected?.lang?.toLowerCase?.() || '';

    if (lang.startsWith('es')) return 'Guia de voz lista';
    if (lang.startsWith('fr')) return 'Guide vocale prete';
    if (lang.startsWith('de')) return 'Sprachhilfe bereit';
    if (lang.startsWith('it')) return 'Guida vocale pronta';
    if (lang.startsWith('pt')) return 'Guia de voz pronta';
    if (lang.startsWith('ja')) return 'Boisu gaido ga junbi dekimashita';
    if (lang.startsWith('ko')) return 'Eumseong annae junbi wanlyo';

    return 'Voice guidance ready';
}

export function speakText(
    text,
    options = {},
    synth = globalThis.speechSynthesis,
    UtteranceCtor = globalThis.SpeechSynthesisUtterance,
) {
    if (!text || !synth || !UtteranceCtor) return;

    try {
        synth.cancel?.();
        const utterance = new UtteranceCtor(text);
        const selectedVoice = findSelectedVoice(synth.getVoices?.() ?? [], options.voiceURI);
        if (selectedVoice) {
            if (selectedVoice.lang) utterance.lang = selectedVoice.lang;
            utterance.voice = selectedVoice;
        }
        synth.speak?.(utterance);
    } catch {
        // Speech is a progressive enhancement; fail silently when unavailable.
    }
}
