'use client';
import ProviderChoices from '../provider-choices';
import { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, UserPlus } from 'lucide-react';
import { messages, type MessageKey } from '@/lib/i18n';
import { apiJson, errorInfo, errorText, errorMessages, type ErrorInfo } from '@/lib/errors';
type Status={signedIn:boolean;verifiedEmail:string;existing:boolean;needsSetup:boolean};
type Mode='login'|'signup'|'setup';
export default function AccountAccess({mode, returnTo, initialError}: {
  mode: Mode;
  returnTo: string;
  initialError: string | null;
}) {
  const [lang,setLang]=useState(0),[status,setStatus]=useState<Status|null>(null),[email,setEmail]=useState(''),[name,setName]=useState(''),[telegram,setTelegram]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<ErrorInfo|null>(() => initialError && Object.hasOwn(errorMessages, initialError) ? {code:initialError as ErrorInfo['code']} : null);
  const t=(key:MessageKey)=>messages[key][lang];
  useEffect(() => {
    try {
      const n = Number(localStorage.getItem('fragweb-language'));
      if ([0, 1, 2].includes(n)) setLang(n);
    } catch {}
  }, []);
  useEffect(() => {
    if (mode !== 'setup') return;
    fetch('/api/account', { cache: 'no-store' }).then(apiJson<Status>).then(data => {
      setStatus(data);
      setEmail(data.verifiedEmail);
    }).catch(error => setError(errorInfo(error)));
  }, [mode]);
  useEffect(() => { document.documentElement.lang = ['en', 'ru', 'uz'][lang]; }, [lang]);
  const modeLink = (target: Mode) => '/account?' + new URLSearchParams({
    mode: target,
    returnTo,
  });
  async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setError(null);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||password.length<12||password.length>128||mode==='signup'&&name.trim().length<2){setError({code:mode==='login'?'loginInput':'accountInput'});return;}
    if(mode!=='login'&&password!==confirm){setError({code:'passwordMismatch'});return;}
    setBusy(true);try{await apiJson(await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json','x-fragweb-language':['en','ru','uz'][lang]},body:JSON.stringify({mode,email,password,confirmPassword:confirm,...(mode==='signup'?{displayName:name,telegram}:{})})}));setPassword('');setConfirm('');window.location.assign(returnTo);}catch(e){setError(errorInfo(e));}finally{setBusy(false);}}
  const title=mode==='login'?'marketLogin':mode==='signup'?'marketSignup':'setupPassword';
  const verificationReturn='/account?mode='+mode+'&returnTo='+encodeURIComponent(returnTo);
  return <div className="account-access"><header className="shell account-access-header"><a className="logo" href="/">frag<span>web</span><i>✳︎</i></a><select className="language" aria-label="Language" value={lang} onChange={e=>{setLang(+e.target.value);try{localStorage.setItem('fragweb-language',e.target.value);}catch{}}}><option value={0}>EN</option><option value={1}>RU</option><option value={2}>UZ</option></select></header><main className="account-access-card"><span className="modal-icon">{mode==='signup'?<UserPlus size={24}/>:<LockKeyhole size={24}/>}</span><h1>{t(title)}</h1><p>{t(mode==='login'?'marketLoginDesc':mode==='setup'?'verifyEmailHelp':'nativeSignupHelp')}</p><div className="tabs account-auth-tabs"><a className={mode==='login'?'selected':''} aria-current={mode==='login'?'page':undefined} href={modeLink('login')}>{t('marketLogin')}</a><a className={mode==='signup'?'selected':''} aria-current={mode==='signup'?'page':undefined} href={modeLink('signup')}>{t('marketSignup')}</a></div>{error&&<p className="notice error" role="alert">{errorText(error,lang)}</p>}{mode==='setup'&&!status?<p role="status">{t('loading')}</p>:mode==='setup'&&!status?.verifiedEmail?<a className="primary full" target="_top" href={'/signin-with-chatgpt?return_to='+encodeURIComponent(verificationReturn)}>{t('verifyOwnEmail')}<ArrowRight size={16}/></a>:mode==='setup'&&status?.existing?<div><p className="notice">{errorText({code:'accountExists'},lang)}</p><a className="primary full" href={modeLink('login')}>{t('marketLogin')}<ArrowRight size={16}/></a></div>:<form action="/api/account" method="post" onSubmit={submit} noValidate><input type="hidden" name="mode" value={mode}/><input type="hidden" name="returnTo" value={returnTo}/><fieldset disabled={busy}>{mode==='signup'&&<label className="field">{t('name')}<input name="displayName" autoComplete="name" minLength={2} maxLength={70} value={name} onChange={e=>setName(e.target.value)} required/></label>}
  {mode === 'signup' && (
    <label className="field">
      {t('username')}
      <input name="telegram" value={telegram} onChange={event => setTelegram(event.target.value)}
        placeholder="@username" autoCapitalize="none" spellCheck={false} maxLength={33} required
        aria-invalid={error?.code === 'username' || undefined} aria-describedby="signup-telegram-help" />
      <span id="signup-telegram-help" className="fine-print">{t('signupTelegramHelp')}</span>
    </label>
  )}
  <label className="field">{t('email')}<input type="email" name="email" autoComplete="username" value={email} readOnly={mode==='setup'} maxLength={254} onChange={e=>setEmail(e.target.value)} required/></label><label className="field">{t('password')}<input type="password" name="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} required/></label>{mode!=='login'&&<label className="field">{t('confirmPassword')}<input type="password" name="confirmPassword" autoComplete="new-password" minLength={12} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>}<p className="fine-print">{t('passwordHelp')}</p><button className="primary full" disabled={busy}>{t(busy?'saving':title)}<ArrowRight size={16}/></button></fieldset></form>}{mode!=='setup'&&<ProviderChoices key={mode} lang={lang} intent={mode==='signup'?'signup':'login'} returnTo={returnTo}/>}{mode==='login'&&<a className="account-setup-link" href={modeLink('setup')}>{t('legacySetupLink')}</a>}{mode!=='login'&&status?.verifiedEmail&&<a className="account-setup-link" href={'/signout-with-chatgpt?return_to='+encodeURIComponent(verificationReturn)} target="_top">{t('adminSwitch')}</a>}<a className="account-back-link" href="/">{t('backMarket')}</a></main></div>;
}
