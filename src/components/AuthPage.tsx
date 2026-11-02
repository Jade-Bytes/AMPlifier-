import { ArrowRight, BookOpenCheck, ChartNoAxesCombined, CircleAlert, GraduationCap, LockKeyhole } from 'lucide-react';
import { BrandMark, BrandWord } from './ui/Brand';

type AuthPageProps = {
  configured: boolean;
  loading: boolean;
  error: string;
  onGoogleSignIn: () => void;
  /** Desktop app: Google sign-in finishes in the default browser, so waiting gets its own state. */
  signInInBrowser?: boolean;
  onCancelSignIn?: () => void;
  onDemoPreview: () => void;
  showDemoPreview: boolean;
};

/** A grade trend drawn as a signal: steady, a dip, then the gain. Decorative. */
function SignalTrace() {
  return <svg className="auth-trace" viewBox="0 0 1200 260" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="auth-trace-gradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="var(--signal)" stopOpacity="0"/>
        <stop offset="25%" stopColor="var(--signal)"/>
        <stop offset="70%" stopColor="var(--gain)"/>
        <stop offset="100%" stopColor="var(--gain)" stopOpacity=".2"/>
      </linearGradient>
    </defs>
    <path className="trace-echo" d="M0 178 C120 178 160 150 240 156 S380 196 460 170 S600 104 700 120 S860 60 960 66 S1120 30 1200 26"/>
    <path className="trace-main" d="M0 190 C110 190 150 168 230 172 S360 214 440 186 S560 112 660 128 S800 150 880 96 S1060 34 1200 22"/>
  </svg>;
}

export default function AuthPage({ configured, loading, error, onGoogleSignIn, signInInBrowser = false, onCancelSignIn, onDemoPreview, showDemoPreview }: AuthPageProps) {
  return <main className="auth-page">
    <section className="auth-story">
      <SignalTrace/>
      <a className="auth-brand" href="/" aria-label="AMPlifier home"><BrandMark/><BrandWord/></a>
      <div className="auth-story-copy">
        <span className="auth-eyebrow"><span/> Your academic command center</span>
        <h1>Make your next move count.</h1>
        <p>Keep your grades, goals, and schoolwork in one clear place. Pick up where you left off, from any device.</p>
        <div className="auth-benefits">
          <div><span><ChartNoAxesCombined size={18}/></span><div><b>See your progress</b><small>Understand every score and how it moves your grade.</small></div></div>
          <div><span><BookOpenCheck size={18}/></span><div><b>Stay ahead of class</b><small>Keep upcoming assignments and deadlines in view.</small></div></div>
          <div><span><LockKeyhole size={18}/></span><div><b>Your account, your data</b><small>Your academic records are saved to your account.</small></div></div>
        </div>
      </div>
      <span className="auth-footer">AMPlifier. Your academics, amplified.</span>
    </section>
    <section className="auth-panel-wrap">
      <div className="auth-panel glass">
        <div className="auth-panel-icon"><GraduationCap size={22}/></div>
        <div className="auth-form-eyebrow">Welcome to AMPlifier</div>
        <h2>Sign in or create your account</h2>
        <p>{signInInBrowser ? 'Sign in with Google in your web browser, where your accounts are already signed in. You’ll come straight back here.' : 'Use your Google account to securely access your academic workspace.'}</p>
        {error && <div className="auth-error" role="alert"><CircleAlert size={16}/><span>{error}</span></div>}
        <button className="google-signin-btn" onClick={onGoogleSignIn} disabled={!configured || loading}>
          {loading ? <span className="auth-spinner" aria-hidden="true"/> : <svg aria-hidden="true" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.9a11.1 11.1 0 0 1-4.78 7.29l7.73 6c4.51-4.18 7.13-10.33 7.13-17.76Z"/><path fill="#FBBC05" d="M10.54 28.59A14.44 14.44 0 0 1 9.75 24c0-1.59.28-3.13.78-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.89.93 7.57 2.56 10.78l7.98-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.79l-7.73-6c-2.14 1.44-4.87 2.29-8.17 2.29-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>}
          {loading ? (signInInBrowser ? 'Waiting for your browser…' : 'Connecting to Google…') : 'Continue with Google'}{!loading && <ArrowRight size={17}/>}
        </button>
        {loading && signInInBrowser && <div className="auth-browser-wait" role="status">
          <span>Finish signing in in the browser tab that just opened.</span>
          <span><button type="button" className="link-btn" onClick={onGoogleSignIn}>Open it again</button> · <button type="button" className="link-btn" onClick={onCancelSignIn}>Cancel</button></span>
        </div>}
        {!configured && <div className="auth-setup-note"><CircleAlert size={15}/><span>Firebase is not configured yet. Copy <code>.env.example</code> to <code>.env.local</code>, add your Firebase web app keys, then restart the dev server.</span></div>}
        {showDemoPreview && <><button className="demo-preview-btn" onClick={onDemoPreview} disabled={loading}>Explore with sample data</button><small className="demo-preview-caption">Preview the app with fictional grades. Nothing is saved.</small></>}
        <div className="auth-divider"/>
        <div className="auth-privacy"><LockKeyhole size={14}/><span>Secure sign-in powered by Firebase Authentication</span></div>
        <small className="auth-terms">By continuing, you agree to use AMPlifier responsibly and keep your account secure.</small>
      </div>
    </section>
  </main>;
}
