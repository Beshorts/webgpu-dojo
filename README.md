# Milestone 1 — Body Tracking + Recording Tool

Strumento interno per il maestro: apre la webcam, fa girare MediaPipe Pose,
normalizza i 14 keypoints corpo-relativi in real-time e registra ogni frame
in un JSON strutturato.

---

## Setup rapido

### 1. Installa le dipendenze aggiuntive

```bash
npm install @mediapipe/tasks-vision
```

### 2. Copia i file nel progetto

```
src/
  types/
    pose.ts                   ← Tipi TypeScript + costanti
  utils/
    poseNormalization.ts      ← Normalizzazione corpo-relativa
    skeletonDrawing.ts        ← Disegno canvas + HUD
  hooks/
    usePose.ts                ← MediaPipe + webcam
    useRecorder.ts            ← Stato recording + frame collection
  components/
    RecordingTool.tsx         ← Componente principale
  index.css                   ← Stile (sostituisce o affianca il tuo)
  App.tsx                     ← Entry point
```

### 3. Avvia

```bash
npm run dev
```

---

## Come usare il tool

1. **Inserisci nome mossa** — es. `mawashi-geri`
2. **Inserisci class label** — es. `mawashi_geri` (minuscolo, underscore)
3. **Premi ● REC** → 3 secondi di countdown, poi registrazione
4. **Premi ■ STOP** → il tool elabora e mostra la sessione
5. **Clicca ↓ Download JSON** → scarica il file

---

## Formato JSON output

```json
{
  "id": "mawashi_geri_1717000000000",
  "moveName": "mawashi-geri",
  "label": "mawashi_geri",
  "startedAt": "2024-05-29T14:32:00.000Z",
  "durationMs": 2340,
  "fps": 28,
  "totalFrames": 67,
  "frames": [
    {
      "timestamp": 0,
      "frameIndex": 0,
      "normalizationScale": 0.312,
      "hipCenter": { "x": 0.501, "y": 0.621, "z": -0.02 },
      "keypoints": [
        {
          "name": "nose",
          "x": -0.04,
          "y": -3.12,
          "z": -0.18,
          "visibility": 0.99
        },
        { "name": "left_shoulder", ... },
        { "name": "right_shoulder", ... },
        { "name": "left_elbow", ... },
        { "name": "right_elbow", ... },
        { "name": "left_wrist", ... },
        { "name": "right_wrist", ... },
        { "name": "left_hip", ... },
        { "name": "right_hip", ... },
        { "name": "left_knee", ... },
        { "name": "right_knee", ... },
        { "name": "left_ankle", ... },
        { "name": "right_ankle", ... },
        { "name": "neck", ... }
      ]
    }
  ],
  "meta": {
    "keypointNames": ["nose", "left_shoulder", ...],
    "normalizationMethod": "hip_center_torso_scale",
    "mediapipeVersion": "0.10.x"
  }
}
```

---

## Normalizzazione corpo-relativa

| Parametro | Valore |
|-----------|--------|
| **Origin** | Midpoint (left_hip, right_hip) → `(0, 0, 0)` |
| **Scala** | Distanza hip_center → shoulder_center (lunghezza torso) |
| **Output** | `(point - origin) / scale` — invariante a posizione e statura |

I 14 keypoints sono quindi **indipendenti da**:
- Posizione del soggetto nel frame
- Distanza dalla telecamera (scala)
- Altezza del soggetto

---

## Keypoints (indice → nome → indice MediaPipe)

| # | Nome | MP idx |
|---|------|--------|
| 0 | nose | 0 |
| 1 | left_shoulder | 11 |
| 2 | right_shoulder | 12 |
| 3 | left_elbow | 13 |
| 4 | right_elbow | 14 |
| 5 | left_wrist | 15 |
| 6 | right_wrist | 16 |
| 7 | left_hip | 23 |
| 8 | right_hip | 24 |
| 9 | left_knee | 25 |
| 10 | right_knee | 26 |
| 11 | left_ankle | 27 |
| 12 | right_ankle | 28 |
| 13 | neck | *calcolato* |

---

## Architettura moduli

```
usePose.ts
  └─ Gestisce webcam + MediaPipe PoseLandmarker (VIDEO mode)
  └─ Chiama onFrame(landmarks, timestamp) ad ogni frame

useRecorder.ts
  └─ Riceve i landmark raw da usePose via onPoseFrame()
  └─ Durante recording: chiama normalizeFrame() e accumula PoseFrame[]
  └─ stopRecording() → costruisce RecordingSession e ritorna l'oggetto

RecordingTool.tsx
  └─ Render loop su canvas (rAF): video + skeleton overlay + HUD
  └─ Controlla usePose + useRecorder
  └─ Lista sessioni + download JSON
```

---

## Milestone successivi (preview)

- **M2** — Dataset manager: visualizzatore frame-by-frame, trim, augmentation
- **M3** — Classifier: training in-browser con TensorFlow.js su dataset registrato
- **M4** — Live inference: riconosce la mossa in real-time e mostra il match score