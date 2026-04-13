// ─── Keypoint names (14 body points) ──────────────────────────────────────────
export const KEYPOINT_NAMES = [
  'nose',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
  'neck', // computed: shoulder midpoint
] as const;

export type KeypointName = (typeof KEYPOINT_NAMES)[number];
export const NUM_KEYPOINTS = KEYPOINT_NAMES.length; // 14

// MediaPipe indices → our 14 keypoints
// neck is virtual, computed from left_shoulder + right_shoulder
export const MEDIAPIPE_INDICES: Record<Exclude<KeypointName, 'neck'>, number> = {
  nose: 0,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28,
};

// ─── Data structures ──────────────────────────────────────────────────────────

/** Raw MediaPipe point (normalized 0-1 coordinates, optional z) */
export interface RawLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** Body-relative normalized keypoint */
export interface NormalizedKeypoint {
  name: KeypointName;
  /** x relative to hip center, scaled by torso length */
  x: number;
  /** y relative to hip center, scaled by torso length */
  y: number;
  /** relative z (depth) */
  z: number;
  /** visibility confidence [0, 1] */
  visibility: number;
}

/** Full frame: 14 normalized keypoints + metadata */
export interface PoseFrame {
  /** Timestamp in ms since recording start */
  timestamp: number;
  /** Frame index (0-based) */
  frameIndex: number;
  /** 14 normalized keypoints */
  keypoints: NormalizedKeypoint[];
  /** Scale factor used (torso length in normalized coordinates) */
  normalizationScale: number;
  /** Hip center in original coordinates */
  hipCenter: { x: number; y: number; z: number };
}

/** Full recording session — final JSON output */
export interface RecordingSession {
  id: string;
  /** Move name entered by the instructor */
  moveName: string;
  /** Class label for ML */
  label: string;
  /** Start date/time */
  startedAt: string;
  /** Duration in ms */
  durationMs: number;
  /** Estimated frame rate */
  fps: number;
  /** Total frame count */
  totalFrames: number;
  /** All frames */
  frames: PoseFrame[];
  /** Additional metadata */
  meta: {
    keypointNames: readonly string[];
    normalizationMethod: 'hip_center_torso_scale';
    mediapipeVersion: string;
  };
}

// ─── Skeleton connections (keypoint index pairs) ──────────────────────────────
// Used to draw bones on the canvas
export const SKELETON_CONNECTIONS: [number, number][] = [
  // Torso
  [1, 2],   // left_shoulder - right_shoulder
  [1, 7],   // left_shoulder - left_hip
  [2, 8],   // right_shoulder - right_hip
  [7, 8],   // left_hip - right_hip
  // Neck (virtual)
  [13, 1],  // neck - left_shoulder
  [13, 2],  // neck - right_shoulder
  [13, 0],  // neck - nose
  // Left arm
  [1, 3],   // left_shoulder - left_elbow
  [3, 5],   // left_elbow - left_wrist
  // Right arm
  [2, 4],   // right_shoulder - right_elbow
  [4, 6],   // right_elbow - right_wrist
  // Left leg
  [7, 9],   // left_hip - left_knee
  [9, 11],  // left_knee - left_ankle
  // Right leg
  [8, 10],  // right_hip - right_knee
  [10, 12], // right_knee - right_ankle
];

// ─── Recording status ─────────────────────────────────────────────────────────
export type RecordingStatus = 'idle' | 'countdown' | 'recording' | 'processing' | 'done';
