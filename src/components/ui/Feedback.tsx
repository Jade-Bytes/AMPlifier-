import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import Dialog from './Dialog';
import { useSound } from '../../lib/preferences';
import type { SoundName } from '../../lib/sound';

export type Tone = 'success' | 'error' | 'info';
type ToastAction = { label: string; run: () => void };
type Toast = { id: number; message: string; tone: Tone; action?: ToastAction; life: number; leaving?: boolean };
export type NotifyOptions = { tone?: Tone; action?: ToastAction; sound?: SoundName };
type ConfirmOptions = { title: string; message?: ReactNode; confirmLabel?: string; destructive?: boolean };
type FeedbackApi = { notify: (message: string, options?: NotifyOptions) => void; confirm: (options: ConfirmOptions) => Promise<boolean> };

const FeedbackContext = createContext<FeedbackApi | null>(null);
// Most successes are saves, so the default is the soft save chime; new records ask for 'success'.
const TONE_SOUND: Record<Tone, SoundName> = { success: 'save', error: 'error', info: 'notify' };
const EXIT_MS = 200;

export function useFeedback(): FeedbackApi {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return value;
}

/** Toast notifications (with optional Undo) and a promise-based confirmation dialog. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);
  const nextId = useRef(1);
  const timers = useRef(new Set<number>());
  const play = useSound();

  useEffect(() => () => { timers.current.forEach(timer => window.clearTimeout(timer)); }, []);

  const later = useCallback((run: () => void, ms: number) => {
    const timer = window.setTimeout(() => { timers.current.delete(timer); run(); }, ms);
    timers.current.add(timer);
  }, []);

  // Toasts play a short exit animation before they are removed.
  const dismiss = useCallback((id: number) => {
    setToasts(current => current.map(toast => toast.id === id ? { ...toast, leaving: true } : toast));
    later(() => setToasts(current => current.filter(toast => toast.id !== id)), EXIT_MS);
  }, [later]);

  const notify = useCallback((message: string, options: NotifyOptions = {}) => {
    const id = nextId.current++;
    const tone = options.tone ?? 'success';
    const life = options.action ? 6500 : tone === 'error' ? 6000 : 3200;
    setToasts(current => [...current.slice(-2), { id, message, tone, action: options.action, life }]);
    play(options.sound ?? TONE_SOUND[tone]);
    later(() => dismiss(id), life);
  }, [dismiss, later, play]);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => setPending({ ...options, resolve })), []);
  const api = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  function settle(value: boolean) {
    pending?.resolve(value);
    setPending(null);
  }

  return <FeedbackContext.Provider value={api}>
    {children}
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map(toast => <div className={`toast glass-float toast-${toast.tone} ${toast.leaving ? 'is-leaving' : ''}`} key={toast.id} style={{ '--life': `${toast.life}ms` } as CSSProperties}>
        <span className="toast-icon" aria-hidden="true">{toast.tone === 'error' ? <AlertTriangle size={15}/> : toast.tone === 'info' ? <Info size={15}/> : <Check size={15}/>}</span>
        <span className="toast-message">{toast.message}</span>
        {toast.action && <button className="toast-action" onClick={() => { toast.action!.run(); dismiss(toast.id); }}>{toast.action.label}</button>}
        <button className="toast-close" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}><X size={14}/></button>
      </div>)}
    </div>
    {pending && <Dialog title={pending.title} size="sm" onClose={() => settle(false)} footer={<>
      <button className="btn btn-secondary" onClick={() => settle(false)}>Cancel</button>
      <button className={`btn ${pending.destructive ? 'btn-danger' : 'btn-primary'}`} data-autofocus onClick={() => settle(true)}>{pending.confirmLabel ?? 'Confirm'}</button>
    </>}>
      {pending.message && <div className="confirm-message">{pending.message}</div>}
    </Dialog>}
  </FeedbackContext.Provider>;
}
