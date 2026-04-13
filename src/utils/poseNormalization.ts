import type { RawLandmark, NormalizedKeypoint, PoseFrame } from '../types/pose';
import { KEYPOINT_NAMES, MEDIAPIPE_INDICES } from '../types/pose';

// ─── Geometric helpers ────────────────────────────────────────────────────────

function midpoint(a: RawLandmark, b: RawLandmark): RawLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

function distance3D(a: RawLandmark, b: RawLandmark): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2) +
    Math.pow(a.z - b.z, 2)
  );
}

// ─── Body-relative normalization ──────────────────────────────────────────────
/**
 * Converts the 33 MediaPipe landmarks into 14 body-relative normalized keypoints.
 *
 * Method:
 *  1. Origin  → hip center (midpoint left_hip, right_hip)
 *  2. Scale   → torso length (distance hip_center → shoulder_center)
 *  3. Output  → (point - origin) / scale for x, y, z
 *
 * This makes coordinates invariant to subject position and body size.
 */
export function normalizeFrame(
  landmarks: RawLandmark[],
  timestamp: number,
  frameIndex: number
): PoseFrame | null {
  if (landmarks.length < 29) return null;

  const leftHip = landmarks[MEDIAPIPE_INDICES.left_hip];
  const rightHip = landmarks[MEDIAPIPE_INDICES.right_hip];
  const leftShoulder = landmarks[MEDIAPIPE_INDICES.left_shoulder];
  const rightShoulder = landmarks[MEDIAPIPE_INDICES.right_shoulder];

  // Reference points
  const hipCenter = midpoint(leftHip, rightHip);
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);

  // Scale = torso length (in normalized MediaPipe coordinates)
  const scale = distance3D(hipCenter, shoulderCenter);
  if (scale < 1e-6) return null; // subject too far away or heavily occluded

  // Virtual neck = shoulder midpoint
  const neck = shoulderCenter;

  // 14-keypoint mapping
  const rawPoints: Record<string, RawLandmark> = {
    nose: landmarks[MEDIAPIPE_INDICES.nose],
    left_shoulder: leftShoulder,
    right_shoulder: rightShoulder,
    left_elbow: landmarks[MEDIAPIPE_INDICES.left_elbow],
    right_elbow: landmarks[MEDIAPIPE_INDICES.right_elbow],
    left_wrist: landmarks[MEDIAPIPE_INDICES.left_wrist],
    right_wrist: landmarks[MEDIAPIPE_INDICES.right_wrist],
    left_hip: leftHip,
    right_hip: rightHip,
    left_knee: landmarks[MEDIAPIPE_INDICES.left_knee],
    right_knee: landmarks[MEDIAPIPE_INDICES.right_knee],
    left_ankle: landmarks[MEDIAPIPE_INDICES.left_ankle],
    right_ankle: landmarks[MEDIAPIPE_INDICES.right_ankle],
    neck: neck,
  };

  const keypoints: NormalizedKeypoint[] = KEYPOINT_NAMES.map((name) => {
    const raw = rawPoints[name];
    return {
      name,
      x: (raw.x - hipCenter.x) / scale,
      y: (raw.y - hipCenter.y) / scale,
      z: (raw.z - hipCenter.z) / scale,
      visibility: raw.visibility ?? 1,
    };
  });

  return {
    timestamp,
    frameIndex,
    keypoints,
    normalizationScale: scale,
    hipCenter: { x: hipCenter.x, y: hipCenter.y, z: hipCenter.z },
  };
}

// ─── FPS calculation from frame list ──────────────────────────────────────────
export function computeFps(frames: PoseFrame[]): number {
  if (frames.length < 2) return 0;
  const elapsed = frames[frames.length - 1].timestamp - frames[0].timestamp;
  return Math.round(((frames.length - 1) / elapsed) * 1000);
}
