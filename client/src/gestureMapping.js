const FINGER_ROOT = { 1: 'C', 2: 'D', 3: 'E', 4: 'F', 5: 'G' };

export function getHandLandmarks(results) {
    return results?.landmarks ?? results?.handLandmarks ?? [];
}

export function getHandedness(results) {
    return results?.handedness ?? results?.handednesses ?? [];
}

export function normalizeLabel(handedness) {
    return handedness?.[0]?.categoryName?.toLowerCase() ?? null;
}

export function isRightHand(lm, handedness) {
    const label = normalizeLabel(handedness);
    if (label === 'right') return true;
    if (label === 'left') return false;

    // Fall back to frame position only when MediaPipe omits handedness metadata.
    return lm[0].x < 0.5;
}

export function countFingers(lm, handedness) {
    const pairs = [[8, 6], [12, 10], [16, 14], [20, 18]];
    const openFingers = pairs.reduce((n, [tip, pip]) => n + (lm[tip].y < lm[pip].y ? 1 : 0), 0);

    const thumbTip = lm[4];
    const thumbIp = lm[3];
    const thumbOpen = isRightHand(lm, handedness)
        ? thumbTip.x < thumbIp.x
        : thumbTip.x > thumbIp.x;

    return openFingers + (thumbOpen ? 1 : 0);
}

export function detectGesture(results) {
    let quality = null;
    let root = null;
    const landmarks = getHandLandmarks(results);
    const handednesses = getHandedness(results);

    for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        const handedness = handednesses[i];
        const n = countFingers(lm, handedness);

        if (isRightHand(lm, handedness)) {
            if (FINGER_ROOT[n]) root = FINGER_ROOT[n];
        } else {
            if (n >= 4) quality = 'major';
            else if (n <= 1) quality = 'minor';
        }
    }

    return { quality, root };
}
