export interface TimerState {
  slug: string;
  label: string | null;
  status: 'idle' | 'running' | 'paused' | 'done';
  mode: 'countdown' | 'stopwatch';
  duration: number | null; // ms
  startedAt: number | null;
  elapsed: number; // ms
}

export function makeIdleState(slug: string): TimerState {
  return {
    slug,
    label: null,
    status: 'idle',
    mode: 'stopwatch',
    duration: null,
    startedAt: null,
    elapsed: 0,
  };
}

export function startTimer(
  state: TimerState,
  params: { duration?: number; label?: string; now: number }
): TimerState {
  const mode: TimerState['mode'] = params.duration != null ? 'countdown' : 'stopwatch';
  return {
    ...state,
    label: params.label ?? null,
    status: 'running',
    mode,
    duration: params.duration != null ? params.duration * 1000 : null,
    startedAt: params.now,
    elapsed: 0,
  };
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') throw new Error('Timer not running');
  return {
    ...state,
    status: 'paused',
    elapsed: state.elapsed + (now - (state.startedAt ?? now)),
    startedAt: null,
  };
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'paused') throw new Error('Timer not paused');
  return {
    ...state,
    status: 'running',
    startedAt: now,
  };
}

export function resetTimer(state: TimerState): TimerState {
  return {
    ...state,
    label: null,
    status: 'idle',
    startedAt: null,
    elapsed: 0,
  };
}

export function markDone(state: TimerState): TimerState {
  return {
    ...state,
    status: 'done',
    startedAt: null,
  };
}

/**
 * Compute the display value in milliseconds.
 * - Stopwatch: total elapsed (count up)
 * - Countdown: remaining time (count down)
 */
export function computeDisplayMs(state: TimerState, now: number): number {
  const totalElapsed =
    state.status === 'running'
      ? state.elapsed + (now - (state.startedAt ?? now))
      : state.elapsed;
  if (state.mode === 'countdown' && state.duration != null) {
    return Math.max(0, state.duration - totalElapsed);
  }
  return totalElapsed;
}
