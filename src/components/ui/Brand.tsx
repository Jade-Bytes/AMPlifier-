import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { sound } from '../../lib/sound';
import { RotateCcw } from 'lucide-react';

/** The AMPlifier mark: a signal trace that rises — the "gain" in amplifier. */
export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 14.5h3.2l2.1-5.2 3.6 9.2 3-12.2 2.4 8.2h4.7"/></svg>
  </span>;
}

export function BrandWord() {
  return <span className="brand-word">amp<span>lifier</span></span>;
}

/** Atmospheric background shared by every screen: slow-drifting light, faint grain, a hint of scan lines. */
export function Ambient() {
  return <div className="ambient" aria-hidden="true"><i className="aura-a"/><i className="aura-b"/><i className="aura-c"/><i className="scan"/><i className="grain"/></div>;
}

export function LoadingScreen({ message }: { message: string }) {
  return <main className="screen-center" aria-busy="true">
    <div className="loading-mark"><BrandMark/><span className="loading-bar" aria-hidden="true"><i/></span><p role="status">{message}</p></div>
  </main>;
}

/** Last-resort screen when rendering fails. Records are untouched; reloading re-reads them. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) { console.error('AMPlifier crashed while rendering', error, info.componentStack); }

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="screen-center">
      <section className="card error-card" role="alert">
        <BrandMark/>
        <h1>This screen stopped responding</h1>
        <p>Your grades and tasks are saved. Reload AMPlifier to pick up where you left off.</p>
        <pre>{this.state.error.message}</pre>
        <footer><button className="btn btn-primary" onClick={() => window.location.reload()}><RotateCcw size={15}/> Reload AMPlifier</button></footer>
      </section>
    </main>;
  }
}

// Set while a lazily loaded screen shows its skeleton, so the screen can announce it has arrived.
let skeletonShown = false;

/** Placeholder while a screen's code loads. */
export function SkeletonCard() {
  useEffect(() => { skeletonShown = true; }, []);
  return <div className="card" aria-busy="true"><span className="sr-only">Loading…</span>
    <div className="skeleton" style={{ height: 22, width: '30%' }}/><div className="skeleton" style={{ height: 14, width: '55%', marginTop: 12 }}/><div className="skeleton" style={{ height: 180, marginTop: 20 }}/>
  </div>;
}

/** Rendered beside lazily loaded content: plays the "ready" cue only if a skeleton was actually shown. */
export function LoadedCue() {
  useEffect(() => {
    if (!skeletonShown) return;
    skeletonShown = false;
    sound.play('load');
  }, []);
  return null;
}
