import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseFrame, RawLandmark, RecordingSession, RecordingStatus } from '../types/pose';
import { KEYPOINT_NAMES } from '../types/pose';
import { computeFps, normalizeFrame } from '../utils/poseNormalization';
import { drawSkeletonRaw, drawStatusOverlay } from '../utils/skeletonDrawing';

interface UseRecordingControllerOptions {
  countdownSecs?: number;
}

const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';

export function useRecordingController(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  opts: UseRecordingControllerOptions = {}
) {
  const { countdownSecs = 3 } = opts;

  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [countdown, setCountdown] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [liveScale, setLiveScale] = useState(0);
  const [lastSession, setLastSession] = useState<RecordingSession | null>(null);
  const [savedSessions, setSavedSessions] = useState<RecordingSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isCameraRunning, setIsCameraRunning] = useState(false);

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const framesRef = useRef<PoseFrame[]>([]);
  const startTimeRef = useRef(0);
  const frameIndexRef = useRef(0);
  const isMountedRef = useRef(true);
  const isRunningRef = useRef(false);
  const isRecordingRef = useRef(false);
  const pendingMoveRef = useRef({ moveName: '', label: '' });
  const latestStatusRef = useRef<RecordingStatus>('idle');
  latestStatusRef.current = status;

  async function initLandmarker() {
    if (poseLandmarkerRef.current) return poseLandmarkerRef.current;

    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_ASSET_PATH,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });

    return poseLandmarkerRef.current;
  }

  function drawFrame(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, video: HTMLVideoElement, landmarks: RawLandmark[] | null) {
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -W, 0, W, H);
    ctx.restore();

    /* ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, H); */

    if (landmarks) {
      const mirrored = landmarks.map(lm => ({ ...lm, x: 1 - lm.x }));
      drawSkeletonRaw(ctx, mirrored, W, H, {
        jointRadius: 5,
        lineWidth: 2.5,
        glowEnabled: true,
      });
    }

    drawStatusOverlay(ctx, W, H, {
      isRecording:
        latestStatusRef.current === 'recording' &&
        Math.floor(Date.now() / 600) % 2 === 0,
      frameCount,
      fps: 30,
      countdown: latestStatusRef.current === 'countdown' ? countdown : undefined,
      normScale: liveScale > 0 ? liveScale : undefined,
    });
  }

  function loop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = poseLandmarkerRef.current;

    if (!video || !canvas || !landmarker || !isRunningRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
    }

    let landmarks: RawLandmark[] | null = null;

    try {
      const result = landmarker.detectForVideo(video, performance.now());
      landmarks = (result.landmarks[0] as RawLandmark[] | undefined) ?? null;

      if (landmarks && isRecordingRef.current) {
        const ts = performance.now();
        const elapsed = ts - startTimeRef.current;
        const frame = normalizeFrame(landmarks, elapsed, frameIndexRef.current);
        if (frame) {
          framesRef.current.push(frame);
          frameIndexRef.current += 1;
          setFrameCount(frameIndexRef.current);
          setLiveScale(frame.normalizationScale);
        }
      }
    } catch {
      // Keep the loop aligned with the example behavior.
    }

    drawFrame(ctx, canvas, video, landmarks);
    animationRef.current = requestAnimationFrame(loop);
  }

  async function ensureCameraRunning() {
    if (isRunningRef.current && streamRef.current) return true;

    setError(null);

    try {
      await initLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
        facingMode: { ideal: "user" },
        // asking for HD, ut we can accept defined fallback values if the device doesn't support it
        width: { ideal: 1280 },
        height: { ideal: 720 }
  },
        audio: false
       });
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('Video/canvas non disponibili');
      }

      streamRef.current = stream;
      video.srcObject = stream;

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        void video.play();
        isRunningRef.current = true;
        setIsReady(true);
        setIsCameraRunning(true);
        cancelAnimationFrame(animationRef.current);
        animationRef.current = requestAnimationFrame(loop);
      };

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Avvio camera fallito';
      setError(msg);
      return false;
    }
  }

  async function startRecording(moveName: string, label: string) {
    if (status === 'recording' || status === 'countdown') return false;

    const ok = await ensureCameraRunning();
    if (!ok) return false;

    framesRef.current = [];
    frameIndexRef.current = 0;
    setFrameCount(0);
    setLiveScale(0);
    setLastSession(null);
    pendingMoveRef.current = { moveName, label };
    setStatus('countdown');
    setCountdown(countdownSecs);

    let remaining = countdownSecs;
    function tick() {
      remaining -= 1;
      setCountdown(remaining);

      if (remaining <= 0) {
        startTimeRef.current = performance.now();
        isRecordingRef.current = true;
        setStatus('recording');
      } else {
        countdownTimerRef.current = setTimeout(tick, 1000);
      }
    }

    countdownTimerRef.current = setTimeout(tick, 1000);
    return true;
  }

  function stopRecording() {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    const hadRecording = isRecordingRef.current;
    isRecordingRef.current = false;
    isRunningRef.current = false;
    cancelAnimationFrame(animationRef.current);

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.onloadedmetadata = null;
    }

    setIsCameraRunning(false);

    if (!hadRecording) {
      setStatus('idle');
      setCountdown(0);
      return null;
    }

    setStatus('processing');

    const frames = framesRef.current;
    if (frames.length === 0) {
      setStatus('idle');
      return null;
    }

    const { moveName, label } = pendingMoveRef.current;
    const session: RecordingSession = {
      id: `${label}_${Date.now()}`,
      moveName,
      label,
      startedAt: new Date().toISOString(),
      durationMs: frames[frames.length - 1].timestamp,
      fps: computeFps(frames),
      totalFrames: frames.length,
      frames: [...frames],
      meta: {
        keypointNames: KEYPOINT_NAMES,
        normalizationMethod: 'hip_center_torso_scale',
        mediapipeVersion: '0.10.x',
      },
    };

    setLastSession(session);
    setSavedSessions(prev => [session, ...prev]);
    setStatus('done');
    return session;
  }

  function reset() {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    isRecordingRef.current = false;
    isRunningRef.current = false;
    cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.onloadedmetadata = null;
    }

    setStatus('idle');
    setCountdown(0);
    setFrameCount(0);
    setLiveScale(0);
    setLastSession(null);
    setError(null);
    setIsCameraRunning(false);
  }

  function downloadSession(session: RecordingSession) {
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
      isRunningRef.current = false;
      cancelAnimationFrame(animationRef.current);
      streamRef.current?.getTracks().forEach(track => track.stop());
      poseLandmarkerRef.current?.close();
    };
  }, []);

  return {
    status,
    countdown,
    frameCount,
    liveScale,
    lastSession,
    savedSessions,
    error,
    isReady,
    isCameraRunning,
    startRecording,
    stopRecording,
    reset,
    downloadSession,
  };
}
