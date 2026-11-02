import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, collectionGroup, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { ArrowLeft, Check, CircleUserRound, MessageCircle, Plus, Search, Send, ShieldCheck, Users, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import { firestore } from '../services/firebase';

type SocialProfile = { uid: string; displayName: string; photoURL: string; handle: string; bio: string; discoverable: boolean; avatarColor: string };
type Connection = { id: string; users: string[]; requester: string; requesterName?: string; requesterPhotoURL?: string; recipient: string; status: 'pending' | 'accepted' | 'declined' };
type Chat = { id: string; title: string; kind: 'direct' | 'group'; purpose: 'school' | 'fun'; members: string[]; createdBy: string };
type Membership = { id: string; uid: string; status: 'active' | 'invited' | 'left' };
type ChatMessage = { id: string; senderId: string; senderName: string; text: string; createdAt?: { toDate: () => Date } };

const avatarColors = ['#5f8066', '#6b79ae', '#a46f81', '#a2764f', '#4f8790', '#7a6c9a'];
const pairId = (a: string, b: string) => [a, b].sort().join('_');
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase() || '?';

function Avatar({ profile, size = 'normal' }: { profile: Pick<SocialProfile, 'displayName' | 'photoURL' | 'avatarColor'>; size?: 'normal' | 'large' }) {
  return profile.photoURL
    ? <img className={`social-avatar ${size}`} src={profile.photoURL} alt="" referrerPolicy="no-referrer" />
    : <span className={`social-avatar social-avatar-fallback ${size}`} style={{ background: profile.avatarColor || avatarColors[0] }}>{initials(profile.displayName)}</span>;
}

export default function SocialHub({ user, displayName, username }: { user: User; displayName: string; username: string }) {
  const [profile, setProfile] = useState<SocialProfile>({ uid: user.uid, displayName: displayName || user.displayName || 'Student', photoURL: user.photoURL || '', handle: username || `student-${user.uid.slice(0, 6)}`, bio: '', discoverable: false, avatarColor: avatarColors[0] });
  const [people, setPeople] = useState<SocialProfile[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<SocialProfile[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedChat, setSelectedChat] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupPurpose, setGroupPurpose] = useState<'school' | 'fun'>('school');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const notify = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(''), 3000); };
  const acceptedIds = useMemo(() => new Set(connections.filter(item => item.status === 'accepted').flatMap(item => item.users).filter(uid => uid !== user.uid)), [connections, user.uid]);
  const acceptedFriends = useMemo(() => [...new Map([...people, ...friendProfiles].filter(person => acceptedIds.has(person.uid)).map(person => [person.uid, person])).values()], [people, friendProfiles, acceptedIds]);
  const incoming = connections.filter(item => item.recipient === user.uid && item.status === 'pending');
  const outgoing = new Set(connections.filter(item => item.requester === user.uid && item.status === 'pending').map(item => item.recipient));
  const filteredPeople = people.filter(person => person.uid !== user.uid && !acceptedIds.has(person.uid) && `${person.displayName} ${person.handle}`.toLowerCase().includes(search.trim().toLowerCase()));
  const activeChats = chats.filter(chat => memberships.find(member => member.id === chat.id)?.status === 'active');
  const invitedChats = chats.filter(chat => memberships.find(member => member.id === chat.id)?.status === 'invited');
  const currentChat = chats.find(chat => chat.id === selectedChat);
  const chatTitle = (chat: Chat) => chat.kind === 'direct'
    ? [...people, ...friendProfiles].find(person => chat.members.find(uid => uid !== user.uid) === person.uid)?.displayName ?? chat.title
    : chat.title;

  useEffect(() => {
    if (!firestore) { setError('Connect Firebase to use the community.'); return; }
    const db = firestore;
    let active = true;
    getDoc(doc(db, 'socialProfiles', user.uid)).then(snapshot => {
      if (snapshot.exists() && active) setProfile({ ...profile, ...snapshot.data(), uid: user.uid, handle: username || String(snapshot.data().handle ?? profile.handle) } as SocialProfile);
    }).catch(() => setError('Could not load your community profile.'));
    const stopPeople = onSnapshot(query(collection(db, 'socialProfiles'), where('discoverable', '==', true), limit(100)), snapshot => {
      setPeople(snapshot.docs.map(item => ({ ...item.data(), uid: item.id } as SocialProfile)));
    }, () => setError('Could not load discoverable profiles.'));
    const stopConnections = onSnapshot(query(collection(db, 'socialConnections'), where('users', 'array-contains', user.uid)), snapshot => {
      setConnections(snapshot.docs.map(item => ({ ...item.data(), id: item.id } as Connection)));
    }, () => setError('Could not load your friend list.'));
    const stopMemberships = onSnapshot(query(collectionGroup(db, 'members'), where('uid', '==', user.uid)), snapshot => {
      setMemberships(snapshot.docs.map(item => ({ ...item.data(), id: item.ref.parent.parent?.id ?? '' } as Membership)).filter(item => item.id));
    }, () => setError('Could not load your chats.'));
    return () => { active = false; stopPeople(); stopConnections(); stopMemberships(); };
    // The initial user profile is intentionally loaded once for this signed-in account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  useEffect(() => {
    if (!firestore || memberships.length === 0) { setChats([]); return; }
    const db = firestore;
    let active = true;
    Promise.all(memberships.map(async membership => {
      const snapshot = await getDoc(doc(db, 'socialChats', membership.id));
      return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Chat : null;
    })).then(values => { if (active) setChats(values.filter((chat): chat is Chat => Boolean(chat))); })
      .catch(() => setError('Could not load chat details.'));
    return () => { active = false; };
  }, [memberships]);

  useEffect(() => {
    if (!firestore || acceptedIds.size === 0) { setFriendProfiles([]); return; }
    const db = firestore;
    let active = true;
    Promise.all([...acceptedIds].map(async uid => {
      const snapshot = await getDoc(doc(db, 'socialProfiles', uid));
      return snapshot.exists() ? { ...snapshot.data(), uid } as SocialProfile : null;
    })).then(values => { if (active) setFriendProfiles(values.filter((person): person is SocialProfile => Boolean(person))); })
      .catch(() => setError('Could not load your friends’ profiles.'));
    return () => { active = false; };
  }, [acceptedIds]);

  useEffect(() => {
    if (!firestore || !selectedChat || !memberships.some(item => item.id === selectedChat && item.status === 'active')) { setMessages([]); return; }
    return onSnapshot(query(collection(firestore, 'socialChats', selectedChat, 'messages'), orderBy('createdAt', 'asc'), limit(100)), snapshot => {
      setMessages(snapshot.docs.map(item => ({ ...item.data(), id: item.id } as ChatMessage)));
    }, () => setError('Could not load messages.'));
  }, [selectedChat, memberships]);

  async function saveProfile() {
    if (!firestore) return;
    setBusy(true); setError('');
    try {
      const safeProfile = { uid: user.uid, displayName: profile.displayName.trim().slice(0, 40) || 'Student', photoURL: user.photoURL || '', handle: profile.handle, bio: profile.bio.trim().slice(0, 120), discoverable: profile.discoverable, avatarColor: profile.avatarColor, updatedAt: serverTimestamp() };
      await setDoc(doc(firestore, 'socialProfiles', user.uid), safeProfile, { merge: true });
      setProfile(current => ({ ...current, ...safeProfile, updatedAt: undefined } as SocialProfile));
      notify('Profile saved');
    } catch { setError('Could not save your profile. Try again.'); }
    finally { setBusy(false); }
  }

  async function sendFriendRequest(person: SocialProfile) {
    if (!firestore) return;
    setBusy(true);
    try {
      const id = pairId(user.uid, person.uid);
      const connectionRef = doc(firestore, 'socialConnections', id);
      const existing = await getDoc(connectionRef);
      if (existing.exists()) {
        if (existing.data().status !== 'declined') { notify('A request or connection already exists.'); return; }
        const data = existing.data();
        await updateDoc(connectionRef, data.requester === user.uid
          ? { status: 'pending', updatedAt: serverTimestamp() }
          : { status: 'pending', requester: user.uid, requesterName: profile.displayName, requesterPhotoURL: user.photoURL || '', recipient: person.uid, updatedAt: serverTimestamp() });
      } else {
        await setDoc(connectionRef, { users: [user.uid, person.uid].sort(), requester: user.uid, requesterName: profile.displayName, requesterPhotoURL: user.photoURL || '', recipient: person.uid, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      notify(`Friend request sent to ${person.displayName}`);
    } catch { setError('Could not send that friend request.'); }
    finally { setBusy(false); }
  }

  async function respondToRequest(request: Connection, status: 'accepted' | 'declined') {
    if (!firestore) return;
    try { await updateDoc(doc(firestore, 'socialConnections', request.id), { status, updatedAt: serverTimestamp() }); notify(status === 'accepted' ? 'Friend request accepted' : 'Request declined'); }
    catch { setError('Could not update that friend request.'); }
  }

  async function openDirect(friend: SocialProfile) {
    if (!firestore) return;
    const id = `dm_${pairId(user.uid, friend.uid)}`;
    const chatRef = doc(firestore, 'socialChats', id);
    const current = await getDoc(chatRef);
    const batch = writeBatch(firestore);
    if (!current.exists()) batch.set(chatRef, { id, kind: 'direct', purpose: 'fun', title: friend.displayName, members: [user.uid, friend.uid].sort(), createdBy: user.uid, createdAt: serverTimestamp() });
    batch.set(doc(firestore, 'socialChats', id, 'members', user.uid), { uid: user.uid, status: 'active', joinedAt: serverTimestamp() }, { merge: true });
    batch.set(doc(firestore, 'socialChats', id, 'members', friend.uid), { uid: friend.uid, status: 'active', joinedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
    setSelectedChat(id);
  }

  async function createGroup() {
    if (!firestore || !groupName.trim() || groupMembers.length === 0) return;
    setBusy(true); setError('');
    try {
      const chatRef = doc(collection(firestore, 'socialChats'));
      const members = [user.uid, ...groupMembers];
      const batch = writeBatch(firestore);
      batch.set(chatRef, { id: chatRef.id, kind: 'group', purpose: groupPurpose, title: groupName.trim().slice(0, 50), members, createdBy: user.uid, createdAt: serverTimestamp() });
      batch.set(doc(firestore, 'socialChats', chatRef.id, 'members', user.uid), { uid: user.uid, status: 'active', joinedAt: serverTimestamp() });
      for (const uid of groupMembers) batch.set(doc(firestore, 'socialChats', chatRef.id, 'members', uid), { uid, status: 'invited', invitedBy: user.uid, joinedAt: serverTimestamp() });
      await batch.commit();
      setGroupName(''); setGroupMembers([]); setShowGroupForm(false); setSelectedChat(chatRef.id); notify('Group created · invitations sent');
    } catch { setError('Could not create the group. Choose friends and try again.'); }
    finally { setBusy(false); }
  }

  async function acceptChatInvite(chat: Chat) {
    if (!firestore) return;
    try { await updateDoc(doc(firestore, 'socialChats', chat.id, 'members', user.uid), { status: 'active', acceptedAt: serverTimestamp() }); notify(`Joined ${chat.title}`); }
    catch { setError('Could not accept that group invitation.'); }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!firestore || !currentChat || !text) return;
    setMessage('');
    try { await addDoc(collection(firestore, 'socialChats', currentChat.id, 'messages'), { senderId: user.uid, senderName: profile.displayName, text: text.slice(0, 2000), createdAt: serverTimestamp() }); }
    catch { setMessage(text); setError('Message not sent. Check your connection and try again.'); }
  }

  if (!firestore) return <section className="panel social-empty">Connect Firebase to use the community.</section>;

  return <div className="social-page">
    <section className="social-hero panel"><div><div className="result-kicker">Your community</div><h2>Study together. Stay connected.</h2><p>Find classmates, message friends, and make a group for class or fun.</p></div><span className="social-hero-icon"><Users size={22}/></span></section>
    {error && <div className="social-alert" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={14}/></button></div>}
    <div className="social-grid">
      <div className="social-main-column">
        <section className="panel social-profile-panel"><div className="social-panel-heading"><div><h3>Your profile</h3><p>Only your name and photo are visible to people you choose to discover.</p></div><ShieldCheck size={18}/></div>
          <div className="social-profile-edit"><Avatar profile={profile} size="large"/><div className="social-profile-fields"><label>Display name<input value={profile.displayName} maxLength={40} onChange={event => setProfile(current => ({ ...current, displayName: event.target.value }))}/></label><label>About you <span className="muted">Optional</span><input value={profile.bio} maxLength={120} placeholder="A little about yourself" onChange={event => setProfile(current => ({ ...current, bio: event.target.value }))}/></label></div></div>
          <div className="social-profile-bottom"><label className="discover-toggle"><input type="checkbox" checked={profile.discoverable} onChange={event => setProfile(current => ({ ...current, discoverable: event.target.checked }))}/><span>Let other students find me</span></label>{!user.photoURL&&<div className="avatar-colors" aria-label="Avatar color">{avatarColors.map(color => <button key={color} type="button" aria-label={`Choose avatar color ${color}`} aria-pressed={profile.avatarColor === color} style={{ background: color }} onClick={() => setProfile(current => ({ ...current, avatarColor: color }))}/>)}</div>}<button className="primary-btn" disabled={busy} onClick={saveProfile}>{busy ? 'Saving…' : 'Save profile'}</button></div>
          <small className="social-privacy-note">Your grades, email, and school details are never shown on your social profile.</small>
        </section>
        <section className="panel people-panel"><div className="social-panel-heading"><div><h3>Find people</h3><p>Discovery is opt-in. Friend requests are private.</p></div><CircleUserRound size={18}/></div><div className="social-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search names or handles" aria-label="Search people"/></div>
          <div className="people-list">{filteredPeople.slice(0, 12).map(person => {
            const request = outgoing.has(person.uid);
            const requestedByThem = incoming.some(item => item.requester === person.uid);
            return <div className="person-row" key={person.uid}><Avatar profile={person}/><div className="person-copy"><b>{person.displayName}</b><span>@{person.handle}</span>{person.bio && <small>{person.bio}</small>}</div>{requestedByThem ? <button className="subtle-btn" onClick={() => { const item = incoming.find(entry => entry.requester === person.uid); if (item) void respondToRequest(item, 'accepted'); }}><Check size={14}/> Accept</button> : <button className="subtle-btn" disabled={busy || request} onClick={() => void sendFriendRequest(person)}>{request ? 'Requested' : <><Plus size={14}/> Add</>}</button>}</div>;
          })}{filteredPeople.length === 0 && <p className="social-empty-copy">No discoverable people match that search. Friends can turn on discovery in their profile.</p>}</div>
        </section>
      </div>
      <div className="social-side-column">
        <section className="panel friend-panel"><div className="social-panel-heading"><div><h3>Friend requests</h3><p>{incoming.length} waiting for you</p></div><MessageCircle size={18}/></div>{incoming.length ? incoming.map(item => { const person = people.find(candidate => candidate.uid === item.requester) ?? { uid: item.requester, displayName: item.requesterName || 'Student', photoURL: item.requesterPhotoURL || '', handle: '', bio: '', discoverable: true, avatarColor: avatarColors[0] }; return <div className="person-row compact" key={item.id}><Avatar profile={person}/><div className="person-copy"><b>{person.displayName}</b><span>Wants to connect</span></div><button className="icon-btn small-icon" title="Accept" aria-label={`Accept ${person.displayName}`} onClick={() => void respondToRequest(item, 'accepted')}><Check size={15}/></button><button className="icon-btn small-icon" title="Decline" aria-label={`Decline ${person.displayName}`} onClick={() => void respondToRequest(item, 'declined')}><X size={15}/></button></div>; }) : <p className="social-empty-copy">New friend requests will show up here.</p>}</section>
        <section className="panel friends-panel"><div className="social-panel-heading"><div><h3>Your friends</h3><p>{acceptedFriends.length} connected</p></div><Users size={18}/></div>{acceptedFriends.length ? acceptedFriends.map(friend => <button className="friend-row" key={friend.uid} onClick={() => void openDirect(friend)}><Avatar profile={friend}/><span><b>{friend.displayName}</b><small>Open private chat</small></span><MessageCircle size={15}/></button>) : <p className="social-empty-copy">Add people to start a private chat.</p>}</section>
      </div>
    </div>
    <section className="panel chats-panel"><div className="social-panel-heading"><div><h3>Messages & groups</h3><p>Private chats with friends, and group rooms for school or fun.</p></div><button className="primary-btn" onClick={() => setShowGroupForm(value => !value)}><Plus size={15}/> New group</button></div>
      {invitedChats.length > 0 && <div className="chat-invitations"><b>Group invitations</b>{invitedChats.map(chat => <div className="invitation-row" key={chat.id}><span>{chat.title} <small>· {chat.purpose}</small></span><button className="subtle-btn" onClick={() => void acceptChatInvite(chat)}>Join group</button></div>)}</div>}
      {showGroupForm && <div className="group-create"><label>Group name<input value={groupName} maxLength={50} onChange={event => setGroupName(event.target.value)} placeholder="e.g. Science project crew"/></label><label>What’s it for?<select value={groupPurpose} onChange={event => setGroupPurpose(event.target.value as 'school' | 'fun')}><option value="school">Schoolwork</option><option value="fun">Just for fun</option></select></label><div className="group-friend-picks"><b>Invite friends</b>{acceptedFriends.length ? acceptedFriends.map(friend => <label key={friend.uid}><input type="checkbox" checked={groupMembers.includes(friend.uid)} onChange={event => setGroupMembers(current => event.target.checked ? [...current, friend.uid] : current.filter(uid => uid !== friend.uid))}/><Avatar profile={friend}/>{friend.displayName}</label>) : <small>Add a friend before creating a group.</small>}</div><button className="primary-btn" disabled={busy || !groupName.trim() || !groupMembers.length} onClick={() => void createGroup()}>{busy ? 'Creating…' : 'Create group and invite'}</button></div>}
      <div className="chat-layout"><div className="chat-list">{activeChats.map(chat => <button key={chat.id} className={`chat-list-item ${selectedChat === chat.id ? 'selected' : ''}`} onClick={() => setSelectedChat(chat.id)}><span className="chat-list-icon">{chat.kind === 'group' ? <Users size={16}/> : <MessageCircle size={16}/>}</span><span><b>{chatTitle(chat)}</b><small>{chat.kind === 'group' ? (chat.purpose === 'school' ? 'Schoolwork group' : 'For fun') : 'Private chat'}</small></span></button>)}{activeChats.length === 0 && <p className="social-empty-copy">Your chats will appear here. Connect with a friend or start a group.</p>}</div>
        <div className="chat-window">{currentChat ? <><div className="chat-window-heading"><button className="icon-btn small-icon chat-back" aria-label="Back to chats" onClick={() => setSelectedChat('')}><ArrowLeft size={15}/></button><div><b>{chatTitle(currentChat)}</b><small>{currentChat.kind === 'group' ? `${currentChat.members.length} members · ${currentChat.purpose === 'school' ? 'Schoolwork' : 'For fun'}` : 'Private conversation'}</small></div></div><div className="message-list">{messages.map(item => <div className={`message-bubble ${item.senderId === user.uid ? 'mine' : ''}`} key={item.id}><small>{item.senderId === user.uid ? 'You' : item.senderName}</small><p>{item.text}</p><time>{item.createdAt?.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>)}{messages.length === 0 && <p className="social-empty-copy">Say hello to get the conversation started.</p>}</div><form className="message-composer" onSubmit={event => void sendMessage(event)}><input value={message} maxLength={2000} onChange={event => setMessage(event.target.value)} placeholder="Write a message…" aria-label="Message text"/><button className="primary-btn" disabled={!message.trim()} aria-label="Send message"><Send size={16}/></button></form></> : <div className="chat-placeholder"><MessageCircle size={24}/><b>Pick a conversation</b><span>Your chats stay between their members.</span></div>}</div></div>
    </section>
    {notice && <div className="social-toast" role="status"><Check size={15}/>{notice}</div>}
  </div>;
}
