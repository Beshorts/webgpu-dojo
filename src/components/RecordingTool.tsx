import { useRef, useState } from 'react';
import { useRecordingController } from '../hooks/useRecordingController';
import type { RecordingSession } from '../types/pose';

function toJsonKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function SessionCard({
  session,
  onDownload,
}: {
  session: RecordingSession;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-100">
          {session.label}
        </span>
        <span className="text-xs text-white/45">{session.fps} fps</span>
      </div>
      <div className="mt-3 text-base font-semibold text-white">{session.moveName}</div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/55">
        <span>{session.totalFrames} frames</span>
        <span>{(session.durationMs / 1000).toFixed(1)}s</span>
        <span>{new Date(session.startedAt).toLocaleTimeString()}</span>
      </div>
      <button
        className="mt-4 w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
        onClick={onDownload}
      >
        ↓ Download JSON
      </button>
    </div>
  );
}

export default function RecordingTool() {
  const videoRef = useRef<HTMLVideoElement>(null!);
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const [moveName, setMoveName] = useState('');
  const [label, setLabel] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const controller = useRecordingController(videoRef, canvasRef, { countdownSecs: 3 });

  async function handleStart() {
    const trimmedMoveName = moveName.trim();
    const jsonLabel = toJsonKey(label);
    if (!trimmedMoveName || !jsonLabel) return;
    await controller.startRecording(trimmedMoveName, jsonLabel);
  }

  function handleStop() {
    controller.stopRecording();
  }

  function handleReset() {
    controller.reset();
  }

  const canStart = controller.status === 'idle' || controller.status === 'done';
  const canStop = controller.status === 'recording' || controller.status === 'countdown' || controller.isCameraRunning;
  const showCanvasHint =
    !controller.isCameraRunning &&
    !controller.error &&
    (controller.status === 'idle' || controller.status === 'done');
  const statusTone =
    controller.status === 'recording'
      ? 'border-red-500/40 bg-red-500/10 text-red-100'
      : controller.status === 'countdown'
        ? 'border-amber-400/40 bg-amber-400/10 text-amber-50'
        : controller.status === 'done'
          ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-50'
          : 'border-white/10 bg-white/5 text-white/70';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#183047,transparent_40%),linear-gradient(180deg,#0a1219_0%,#05080c_100%)] text-white">
      <button
        type="button"
        aria-label={isSidebarOpen ? 'Chiudi sidebar' : 'Apri sidebar'}
        aria-expanded={isSidebarOpen}
        onClick={() => setIsSidebarOpen(open => !open)}
        className="fixed top-5 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-slate-950/85 text-white shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur transition hover:border-cyan-300/40 hover:bg-slate-900"
      >
        {isSidebarOpen ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Chiudi sidebar"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px]"
        />
      )}

      <aside
        className={`fixed top-0 right-0 z-40 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-slate-950/92 shadow-[0_0_60px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-transform duration-300 ease-out ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col space-y-4 border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-300/70">Control Dock</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Dojo Recorder</h1>
          </div>
          <div className="rounded-full flex justify-center w-[100px] border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
            {controller.isCameraRunning ? 'camera on' : 'camera off'}
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">Sessione</p>
            <label className="flex flex-col space-y-2">
              <span className="text-sm font-medium text-white/80">Nome posizione / mossa</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/50 focus:bg-black/30 disabled:cursor-not-allowed disabled:opacity-50"
                value={moveName}
                onChange={e => setMoveName(e.target.value)}
                placeholder="es. mawashi-geri"
                disabled={!canStart}
              />
            </label>

            <label className="flex flex-col space-y-2">
              <span className="text-sm font-medium text-white/80">Livello / Cintura</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/50 focus:bg-black/30 disabled:cursor-not-allowed disabled:opacity-50"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="es. gialla"
                disabled={!canStart}
              />
            </label>
          </section>

          <section className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">Controls</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleStart}
                disabled={!canStart || !moveName.trim() || !toJsonKey(label)}
                className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-950 disabled:text-white/35"
              >
                ● REC
              </button>
              <button
                onClick={handleStop}
                disabled={!canStop}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/8 disabled:text-white/25"
              >
                ■ STOP
              </button>
            </div>
            {controller.status === 'done' && (
              <button
                onClick={handleReset}
                className="w-full rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
              >
                ↺ NUOVA SESSIONE
              </button>
            )}
          </section>

          <section className={`space-y-2 rounded-3xl border p-4 ${statusTone}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">Runtime</p>
            <p className="text-sm font-medium">
              {controller.status === 'idle' && 'In attesa'}
              {controller.status === 'countdown' && `Countdown: ${controller.countdown}`}
              {controller.status === 'recording' && `Registrazione: ${controller.frameCount} frame`}
              {controller.status === 'processing' && 'Elaborazione'}
              {controller.status === 'done' && `Salvato: ${controller.lastSession?.totalFrames ?? 0} frame`}
            </p>
            <p className="text-xs text-white/60">
              Camera: {controller.isCameraRunning ? 'attiva' : 'spenta'}
            </p>
            {controller.liveScale > 0 && (
              <p className="text-xs text-white/60">Scale: {controller.liveScale.toFixed(3)}</p>
            )}
          </section>

          {controller.error && (
            <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              ⚠ {controller.error}
            </section>
          )}

          {controller.savedSessions.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">Saved Sessions</p>
                <span className="text-xs text-white/35">{controller.savedSessions.length}</span>
              </div>
              <div className="space-y-3">
                {controller.savedSessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onDownload={() => controller.downloadSession(session)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>

      <main className="relative flex min-h-screen w-full items-center justify-center p-3 sm:p-5 md:p-8">
        {showCanvasHint && (
          <div className="canvas-overlay-msg absolute left-1/2 top-4 z-20 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-3xl border border-white/10 bg-slate-950/75 px-5 py-3 text-center text-sm text-white/70 backdrop-blur sm:top-6">
            Premi REC per attivare la videocamera e iniziare il countdown
          </div>
        )}
        <video
          ref={videoRef}
          className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0 [clip-path:inset(50%)]"
          playsInline
          muted
        />
        <div className="relative flex h-[calc(100vh-1.5rem)] w-full items-center justify-center sm:h-[calc(100vh-2.5rem)]">
          <canvas
            ref={canvasRef}
            className="w-full h-full object-cover border border-white/10 bg-black shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
          />
        </div>

        {controller.error && (
          <div className="canvas-overlay-msg error absolute bottom-4 left-1/2 z-20 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-3xl border border-red-400/30 bg-red-500/12 px-5 py-3 text-center text-sm text-red-100 backdrop-blur sm:bottom-6">
            ⚠ {controller.error}
          </div>
        )}
      </main>
    </div>
  );
}
