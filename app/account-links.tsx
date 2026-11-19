import { messages } from '@/lib/i18n';

export default function AccountLinks({lang,returnTo,nav=false}:{lang:number;returnTo?:string;nav?:boolean}) {
  const destination=(mode:'login'|'signup')=>'/account?mode='+mode+(returnTo?'&returnTo='+encodeURIComponent(returnTo):'');
  return <div className={'account-entry-links'+(nav?' account-entry-nav':'')}>
    <a className="outline" href={destination('login')} target="_top">{messages.marketLogin[lang]}</a>
    <a className="primary" href={destination('signup')} target="_top">{messages.marketSignup[lang]}</a>
  </div>;
}
