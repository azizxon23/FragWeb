'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, ArrowUpRight, LockKeyhole, Users, LayoutDashboard, LogOut, Plus, Trash2 } from 'lucide-react';
import { cityNames } from '@/lib/cities';
import AdminPanel from '../admin-panel';
import { messages, type MessageKey } from '@/lib/i18n';
import { apiJson, errorInfo, errorText, type ErrorInfo } from '@/lib/errors';
type Session = { signedIn: boolean; email: string; authenticated: boolean; isOwner: boolean };
type Member = { email: string; isOwner: boolean; createdAt?: number };
export default function AdminPortal() {
  const [lang, setLang] = useState(0), [session, setSession] = useState<Session | null>(null), [section, setSection] = useState('dashboard');
  const [error, setError] = useState<ErrorInfo | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState(false);
  const [members, setMembers] = useState<Member[]>([]), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [reason, setReason] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const t = (key: MessageKey) => messages[key][lang];
  const headers = () => ({ 'Content-Type': 'application/json', 'x-fragweb-language': ['en', 'ru', 'uz'][lang] });
  async function loadSession() {
    try { const data = await apiJson<Session>(await fetch('/api/admin/session', { cache: 'no-store' })); setSession(data); setEmail(data.email); } catch(e) { setError(errorInfo(e)); }
  }
  async function loadMembers() {
    try { setMembers((await apiJson<{rows: Member[]}>(await fetch('/api/admin/accounts', { headers: headers(), cache: 'no-store' }))).rows); } catch(e) { setError(errorInfo(e)); }
  }
  useEffect(() => { try { const n = Number(localStorage.getItem('fragweb-language')); if ([0,1,2].includes(n)) setLang(n); } catch {} loadSession(); }, []);
  useEffect(() => { document.documentElement.lang = ['en','ru','uz'][lang]; }, [lang]);
  useEffect(() => { if (session?.authenticated && section === 'team') loadMembers(); }, [session?.authenticated, section]);
  async function login(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError(null);
    if (!email.trim() || !password) { setError({code:'required'}); setBusy(false); return; }
    try { await apiJson(await fetch('/api/admin/session', { method: 'POST', headers: headers(), body: JSON.stringify({ email, password }) })); setPassword(''); await loadSession(); }
    catch(e) { setError(errorInfo(e)); } finally { setBusy(false); }
  }
  async function logout() {
    if (busy) return; setBusy(true); setError(null);
    try { await apiJson(await fetch('/api/admin/session', { method:'DELETE', headers:headers() })); setMembers([]); setPassword(''); setReason(''); setPending(null); setNotice(false); await loadSession(); }
    catch(e) { setError(errorInfo(e)); } finally { setBusy(false); }
  }
  async function manage(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setError(null); setNotice(false);
    if (reason.trim().length < 5 || reason.trim().length > 300) { setError({code:'reason'}); return; }
    if (!pending && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 12 || password.length > 128)) { setError({code:'adminInput'}); return; }
    setBusy(true);
    try { await apiJson(await fetch('/api/admin/accounts', { method: pending ? 'DELETE' : 'POST', headers:headers(), body:JSON.stringify({ email:pending || email, ...(pending ? {} : {password}), reason }) })); setEmail(''); setPassword(''); setReason(''); setPending(null); setNotice(true); await loadMembers(); }
    catch(e) { setError(errorInfo(e)); } finally { setBusy(false); }
  }
  return <div className="admin-portal">
    <header className="portal-header"><a href="/admin" className="logo">frag<span>web</span><i>✳︎</i></a><span className="portal-label"><ShieldCheck size={14}/>{t('adminPortal')}</span><div className="portal-header-end"><select aria-label="Language" value={lang} onChange={e => { const n = +e.target.value; setLang(n); try {localStorage.setItem('fragweb-language',String(n));} catch {} }}><option value={0}>English</option><option value={1}>Русский</option><option value={2}>O‘zbekcha</option></select><a href="/" target="_blank" rel="noreferrer">{t('backMarket')}<ArrowUpRight size={14}/></a></div></header>
    {!session?.authenticated ? <main className="portal-login"><div className="portal-login-intro"><span className="portal-kicker">FRAGWEB / {t('adminWorkspace')}</span><h1>{t('adminWorkspace')}<span>✳︎</span></h1><p>{t('adminWelcome')}</p><div className="portal-security-note"><LockKeyhole size={18}/><p>{t('adminSessionNote')}</p></div></div><section className="portal-login-card"><span className="portal-lock"><ShieldCheck size={26}/></span><h2>{t('adminPortal')}</h2><p>{t('adminLoginHelp')}</p>{error && <p role="alert" className="notice error">{errorText(error,lang)}</p>}{!session ? <p role="status">{t('loading')}</p> : !session.signedIn ? <a className="primary full" href="/signin-with-chatgpt?return_to=%2Fadmin" target="_top">{t('adminVerify')}<ArrowUpRight size={16}/></a> : <form onSubmit={login} noValidate><p className="portal-identity">{t('adminSignedAs')}<strong>{session.email}</strong></p><label className="field">Email<input type="email" name="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254}/></label><label className="field">{t('adminPassword')}<input type="password" name="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={128}/></label><button className="primary full" disabled={busy}>{t(busy?'saving':'adminEnter')}<LockKeyhole size={15}/></button><a className="portal-switch" href="/signout-with-chatgpt?return_to=%2Fadmin" target="_top">{t('adminSwitch')}</a></form>}</section></main> : <div className="portal-workspace"><aside className="portal-sidebar"><div className="portal-kicker">FRAGWEB / {t('adminPortal')}</div><button className={section==='dashboard'?'selected':''} onClick={()=>{setSection('dashboard');setError(null);setPassword('');setEmail('');setReason('');setPending(null);setNotice(false);}}><LayoutDashboard size={18}/>{t('adminWorkspace')}</button><button className={section==='team'?'selected':''} onClick={()=>{setSection('team');setEmail('');setPassword('');setReason('');setPending(null);setNotice(false);setError(null);}}><Users size={18}/>{t('adminTeam')}</button><div className="portal-sidebar-account"><ShieldCheck size={18}/><strong>{session.email}</strong><span>{t(session.isOwner?'adminOwner':'administrator')}</span><button onClick={logout} disabled={busy}><LogOut size={15}/>{t('adminLogout')}</button></div></aside><main className="portal-content">{section==='dashboard' ? <AdminPanel lang={lang} headers={headers} cityName={city=>cityNames[city]?.[lang] || city}/> : <><div className="portal-content-heading"><span className="portal-kicker">{t('adminTeam')}</span><h1>{t('adminTeam')}</h1><p>{t('adminTeamHelp')}</p></div>{error && <p role="alert" className="notice error">{errorText(error,lang)}</p>}{notice && <p role="status" className="notice">{t('actionSaved')}</p>}<div className="portal-team-grid"><section><h2>{t('adminTeam')}</h2>{members.map(member=><article className="portal-member" key={member.email}><ShieldCheck size={19}/><div><strong>{member.email}</strong><span>{t(member.isOwner?'adminOwner':'administrator')}</span></div>{!member.isOwner && member.email!==session.email && <button className="outline" disabled={busy} aria-label={t('adminRevoke')+': '+member.email} onClick={()=>{setPending(member.email);setReason('');setError(null);setNotice(false);}}><Trash2 size={14}/>{t('adminRevoke')}</button>}</article>)}</section><form className="portal-team-form" onSubmit={manage} noValidate><h2>{t(pending?'adminRevoke':'adminAdd')}</h2>{pending ? <p className="portal-identity">{pending}</p> : <><label className="field">Email<input type="email" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} required/></label><label className="field">{t('adminInitialPassword')}<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={12} maxLength={128} required/></label></>}<label className="field">{t('reason')}<textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={5} maxLength={300} required/></label><div className="form-actions">{pending && <button className="outline" type="button" onClick={()=>{setPending(null);setReason('');}} disabled={busy}>{t('cancel')}</button>}<button className="primary" disabled={busy}>{pending?<Trash2 size={15}/>:<Plus size={15}/>} {t(busy?'saving':pending?'confirm':'adminAdd')}</button></div></form></div></>}</main></div>}
  </div>;
}
