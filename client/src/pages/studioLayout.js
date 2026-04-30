export const STUDIO_UTILITY_SECTIONS = [
    { id: 'input', title: 'Gesture Input', defaultOpen: true },
    { id: 'media', title: 'Media & File Tools', defaultOpen: false },
    { id: 'voice', title: 'Voice Guidance', defaultOpen: false },
    { id: 'fx', title: 'Studio FX', defaultOpen: false },
];

export function getSelectedTrackSummary(selectedTrack) {
    if (!selectedTrack) {
        return {
            title: 'No track selected',
            detail: 'Choose a track in the left rail to add chords or use gesture capture.',
            ready: false,
        };
    }

    return {
        title: `Adding to ${selectedTrack.name}`,
        detail: 'Manual and gesture chord input will land on the selected track.',
        ready: true,
    };
}

export function getStudioActivitySummary({ trackCount, hasAudioTrack, isPlaying }) {
    const trackLabel = `${trackCount} track${trackCount === 1 ? '' : 's'}`;

    if (isPlaying) {
        return `${trackLabel} · Playing`;
    }

    if (hasAudioTrack) {
        return `${trackLabel} · MP3 loaded`;
    }

    return `${trackLabel} · Sequencer ready`;
}

export function getBackdropModeSummary({ bigWebcamMode, isWebcamOn }) {
    if (!bigWebcamMode) {
        return {
            label: 'Backdrop Off',
            detail: 'Use big webcam mode to push the live camera behind the studio overlays.',
        };
    }

    if (!isWebcamOn) {
        return {
            label: 'Backdrop Waiting',
            detail: 'Power on the webcam to fill the full app background.',
        };
    }

    return {
        label: 'Backdrop Live',
        detail: 'The webcam is covering the full app background behind the studio glass panels.',
    };
}
