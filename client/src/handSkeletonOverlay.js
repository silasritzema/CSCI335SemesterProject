import { getHandLandmarks, getHandedness } from './gestureMapping';

export const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17],
];

const PALM_PATH = [0, 1, 5, 9, 13, 17];

function drawJoint(ctx, x, y, radius, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

export function drawHandSkeleton(ctx, results, vw, vh) {
    const landmarks = getHandLandmarks(results);
    const handednesses = getHandedness(results);

    for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        const dominantColor = '#f5f5f5';
        const fillColor = 'rgba(255, 255, 255, 0.14)';
        const mx = (x) => (1 - x) * vw;
        const my = (y) => y * vh;

        ctx.save();
        ctx.shadowColor = dominantColor;

        ctx.fillStyle = fillColor;
        ctx.beginPath();
        PALM_PATH.forEach((pointIndex, pointOffset) => {
            const point = lm[pointIndex];
            const x = mx(point.x);
            const y = my(point.y);
            if (pointOffset === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 0;
        for (const [a, b] of HAND_CONNECTIONS) {
            ctx.beginPath();
            ctx.moveTo(mx(lm[a].x), my(lm[a].y));
            ctx.lineTo(mx(lm[b].x), my(lm[b].y));
            ctx.stroke();
        }

        ctx.strokeStyle = dominantColor;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 12;
        for (const [a, b] of HAND_CONNECTIONS) {
            ctx.beginPath();
            ctx.moveTo(mx(lm[a].x), my(lm[a].y));
            ctx.lineTo(mx(lm[b].x), my(lm[b].y));
            ctx.stroke();
        }

        ctx.shadowBlur = 14;
        for (const pt of lm) {
            const x = mx(pt.x);
            const y = my(pt.y);
            drawJoint(ctx, x, y, 7, 'rgba(255, 255, 255, 0.22)');
            drawJoint(ctx, x, y, 4.5, dominantColor);
            drawJoint(ctx, x, y, 2, '#f8fafc');
        }
        ctx.restore();
    }
}
