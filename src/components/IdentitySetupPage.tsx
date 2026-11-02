import { useState } from 'react';
import { ArrowRight, CircleUserRound } from 'lucide-react';
import { BrandMark, BrandWord } from './ui/Brand';

type Props = { initialDisplayName: string; initialUsername: string; saving: boolean; error: string; onComplete: (displayName: string, username: string) => void };

export default function IdentitySetupPage({ initialDisplayName, initialUsername, saving, error, onComplete }: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername);
  const [formError, setFormError] = useState('');
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = username.trim().toLowerCase().replace(/^@/, '');
    if (displayName.trim().length < 2) { setFormError('Enter a display name with at least 2 characters.'); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) { setFormError('Use a username with 3–20 letters, numbers, or underscores.'); return; }
    setFormError('');
    onComplete(displayName.trim(), clean);
  }
  return <main className="setup-page"><header className="setup-brand"><BrandMark/><BrandWord/><i>Profile setup</i></header><section className="identity-setup-card glass"><div className="setup-icon"><CircleUserRound size={20}/></div><div className="setup-eyebrow">One quick step</div><h1>Choose your profile name</h1><p>Your workspace and grades are safe. Add the display name and unique @username classmates will see.</p><form onSubmit={submit}><label className="setup-field">Display name<input value={displayName} onChange={event=>setDisplayName(event.target.value)} maxLength={40} autoComplete="nickname" required/></label><label className="setup-field">@username<input value={username} onChange={event=>setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,20))} maxLength={20} autoComplete="username" required/><small className="setup-hint">3–20 letters, numbers, or underscores. Must be unique.</small></label>{(formError||error)&&<p className="setup-error" role="alert">{formError||error}</p>}<button className="primary-btn" type="submit" disabled={saving}>{saving?'Saving…':'Save profile and continue'}{!saving&&<ArrowRight size={16}/>}</button></form></section></main>;
}
