export const TUTORIAL_SECTIONS = [
    {
        title: 'Getting Started',
        items: [
            'Select a track in the left sidebar before using gesture input.',
            'Use Enable Gestures to start hand tracking and Power On to preview the webcam feed.',
            'Use Play, Import MIDI, Export MIDI, and Upload MP3 from the top bar as needed.',
        ],
    },
    {
        title: 'Hand Gesture Mapping',
        items: [
            'Left hand controls chord quality: open palm (4 or more fingers) means major, fist or 1 finger means minor.',
            'Right hand controls chord root: 1=C, 2=D, 3=E, 4=F, 5=G.',
            'Watch the Gesture Chords debug panel to confirm handedness and finger counts while testing.',
        ],
    },
    {
        title: 'How Chords Get Added',
        items: [
            'Hold a valid two-hand gesture steady until the hold bar fills.',
            'When the hold completes, the chord is appended to the selected track and spoken aloud.',
            'You can also add or edit chords manually from the controls at the bottom of the page.',
        ],
    },
];
