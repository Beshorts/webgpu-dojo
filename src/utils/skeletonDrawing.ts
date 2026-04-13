import type { RawLandmark, } from '../types/pose';
import { SKELETON_CONNECTIONS, MEDIAPIPE_INDICES } from '../types/pose';

// ─── Colors by body segment ───────────────────────────────────────────────────
const SEGMENT_COLORS: Record<string, string> = {
  torso: '#00FF41',
  arm_left: '#FF6B35',
  arm_right: '#4ECDC4',
  leg_left: '#FF6B9D',
  leg_right: '#C5B4E3',
  head: '#FFD93D',
  default: '#00FF41',
};

function getConnectionColor(i: number, j: number): string {
  // Torso
  if ((i === 1 && j === 2) || (i === 7 && j === 8) ||
      (i === 1 && j === 7) || (i === 2 && j === 8)) return SEGMENT_COLORS.torso;
  // Neck/head
  if (i === 13 || j === 13 || i === 0 || j === 0) return SEGMENT_COLORS.head;
  // Left arm
  if ([1, 3, 5].includes(i) || [1, 3, 5].includes(j)) return SEGMENT_COLORS.arm_left;
  // Right arm
  if ([2, 4, 6].includes(i) || [2, 4, 6].includes(j)) return SEGMENT_COLORS.arm_right;
  // Left leg
  if ([7, 9, 11].includes(i) && [7, 9, 11].includes(j)) return SEGMENT_COLORS.leg_left;
  // Right leg
  if ([8, 10, 12].includes(i) && [8, 10, 12].includes(j)) return SEGMENT_COLORS.leg_right;
  return SEGMENT_COLORS.default;
}

// ─── Draw skeleton from raw MediaPipe landmarks ───────────────────────────────
/**
 * Draws the skeleton on the canvas using raw landmarks (0-1 coordinates).
 * Used during the real-time live preview.
 */
export function drawSkeletonRaw(
  ctx: CanvasRenderingContext2D,
  landmarks: RawLandmark[],
  canvasW: number,
  canvasH: number,
  options: DrawOptions = {}
): void {
  const {
    jointRadius = 5,
    lineWidth = 2.5,
    alpha = 0.9,
    glowEnabled = true,
  } = options;

  if (!landmarks.length) return;

  // Map MP indices → pixel coordinates for the 14 keypoints we use
  //const allMpIndices = Object.values(MEDIAPIPE_INDICES);
  // Include the computed neck
  const lsh = landmarks[MEDIAPIPE_INDICES.left_shoulder];
  const rsh = landmarks[MEDIAPIPE_INDICES.right_shoulder];
  const neckLM: RawLandmark = {
    x: (lsh.x + rsh.x) / 2,
    y: (lsh.y + rsh.y) / 2,
    z: (lsh.z + rsh.z) / 2,
    visibility: Math.min(lsh.visibility ?? 1, rsh.visibility ?? 1),
  };

  // Build a pixel-position array for our 14 keypoints
  // Order: nose(0),lsh(1),rsh(2),lel(3),rel(4),lwr(5),rwr(6),lhp(7),rhp(8),lkn(9),rkn(10),lak(11),rak(12),neck(13)
  const kpOrder = [
    MEDIAPIPE_INDICES.nose,
    MEDIAPIPE_INDICES.left_shoulder,
    MEDIAPIPE_INDICES.right_shoulder,
    MEDIAPIPE_INDICES.left_elbow,
    MEDIAPIPE_INDICES.right_elbow,
    MEDIAPIPE_INDICES.left_wrist,
    MEDIAPIPE_INDICES.right_wrist,
    MEDIAPIPE_INDICES.left_hip,
    MEDIAPIPE_INDICES.right_hip,
    MEDIAPIPE_INDICES.left_knee,
    MEDIAPIPE_INDICES.right_knee,
    MEDIAPIPE_INDICES.left_ankle,
    MEDIAPIPE_INDICES.right_ankle,
    -1, // neck = virtual
  ];

  const pts: { x: number; y: number; v: number }[] = kpOrder.map((mpIdx) => {
    if (mpIdx === -1) {
      return {
        x: neckLM.x * canvasW,
        y: neckLM.y * canvasH,
        v: neckLM.visibility ?? 1,
      };
    }
    const lm = landmarks[mpIdx];
    return {
      x: lm.x * canvasW,
      y: lm.y * canvasH,
      v: lm.visibility ?? 1,
    };
  });

  ctx.save();
  ctx.globalAlpha = alpha;

  // ── Connections (bones) ──
  for (const [i, j] of SKELETON_CONNECTIONS) {
    const a = pts[i];
    const b = pts[j];
    if (!a || !b) continue;
    const visMin = Math.min(a.v, b.v);
    if (visMin < 0.3) continue;

    const color = getConnectionColor(i, j);
    ctx.globalAlpha = alpha * visMin;

    if (glowEnabled) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // ── Joints ──
  ctx.shadowBlur = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p || p.v < 0.3) continue;

    ctx.globalAlpha = alpha * p.v;
    const isExtremity = [5, 6, 11, 12, 0].includes(i); // wrists, ankles, nose
    const r = isExtremity ? jointRadius * 1.4 : jointRadius;

    if (glowEnabled) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Colored ring
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = getConnectionColor(i, i);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Draw info overlay ────────────────────────────────────────────────────────
export function drawStatusOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  opts: {
    isRecording: boolean;
    frameCount: number;
    fps: number;
    countdown?: number;
    normScale?: number;
  }
): void {
  ctx.save();
  const { isRecording, frameCount, fps, countdown, normScale } = opts;

  if (countdown !== undefined && countdown > 0) {
    // Centered countdown
    ctx.font = 'bold 120px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#FF6B35';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#FF6B35';
    ctx.fillText(String(countdown), canvasW / 2, canvasH / 2);
    ctx.shadowBlur = 0;
  }

  // REC indicator
  if (isRecording) {
    // Blinking red dot (blinking is handled outside, this stays red here)
    ctx.beginPath();
    ctx.arc(24, 24, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#FF3B30';
    ctx.shadowColor = '#FF3B30';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = '#FF3B30';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('REC', 40, 24);
  }

  // Bottom-left stats
  const lines = [
    `FRAME  ${frameCount.toString().padStart(5, '0')}`,
    `FPS    ${fps.toString().padStart(5, ' ')}`,
    normScale !== undefined ? `SCALE  ${normScale.toFixed(3)}` : '',
  ].filter(Boolean);

  ctx.font = '11px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  lines.reverse().forEach((line, idx) => {
    const y = canvasH - 12 - idx * 16;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(8, y - 11, line.length * 7 + 8, 14);
    ctx.fillStyle = '#00FF41';
    ctx.fillText(line, 12, y);
  });

  ctx.restore();
}

export interface DrawOptions {
  jointRadius?: number;
  lineWidth?: number;
  alpha?: number;
  glowEnabled?: boolean;
}
