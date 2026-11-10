'use client';
import { useEffect,useRef,useState } from 'react';
import { X } from 'lucide-react';
import { messages,type MessageKey } from '@/lib/i18n';
import { apiJson,errorInfo,errorText,type ErrorInfo } from '@/lib/errors';
import type { ApiHeaders,Profile } from '@/lib/account-types';
import type { Listing } from '@/lib/catalog';
import ListingActivity,{type ActivityData} from './listing-activity';
type Detail=ActivityData&{listing:Listing;seller:Profile|null};
export default function ListingDetails({id,lang,headers,onClose,onUser,cityName}:{id:string;lang:number;headers:ApiHeaders;onClose:()=>void;onUser:(id:string)=>void;cityName:(v:string)=>string}){
 const dialog=useRef<HTMLDialogElement>(null),[data,setData]=useState<Detail|null>(null),[error,setError]=useState<ErrorInfo|null>(null);
 const t=(key:MessageKey)=>messages[key][lang];
 useEffect(()=>{dialog.current?.showModal();const abort=new AbortController();fetch('/api/admin/listings/'+encodeURIComponent(id),{headers:headers(),cache:'no-store',signal:abort.signal}).then(apiJson<Detail>).then(setData).catch(e=>{if(!abort.signal.aborted)setError(errorInfo(e));});return()=>{abort.abort();dialog.current?.close();};},[id]);
 const item=data?.listing;
 return <dialog ref={dialog} className="user-detail-dialog listing-detail-dialog" aria-labelledby="listing-detail-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="dialog-inner"><button className="close" aria-label={t('close')} onClick={onClose}><X size={20}/></button><h2 id="listing-detail-title">{t('listingDetails')}</h2>{error?<p className="notice error" role="alert">{errorText(error,lang)}</p>:!item?<p role="status">{t('loading')}</p>:<><div className="eyebrow">{item.brand}</div><h3>{item.name}</h3><span className="status-badge">{t(item.status==='sold'?'sold':item.status==='archived'?'archived':'activeStatus')}</span><span className="status-badge">{t(item.moderationStatus==='hidden'?'hidden':'visible')}</span><div className="listing-detail-photos">{item.photos.map(photo=><a key={photo} href={photo} target="_blank" rel="noreferrer"><img src={photo} alt={item.name}/></a>)}</div><dl className="record-details"><div><dt>{t('price')}</dt><dd>{new Intl.NumberFormat(['en','ru','uz'][lang]).format(item.price)} UZS</dd></div><div><dt>{t('remaining')}</dt><dd>{item.remaining}/{item.size} ml</dd></div><div><dt>{t('city')}</dt><dd>{cityName(data?.seller?.city||item.city)}</dd></div><div><dt>{t('condition')}</dt><dd>{t(item.condition==='box'?'box':'bottle')}</dd></div></dl><p className="record-bio">{item.description}</p>{data?.seller&&<div className="seller-row"><div><small>{t('seller')}</small><button className="admin-user-open" onClick={()=>onUser(data.seller!.id)}>{data.seller.displayName}</button><p>{data.seller.email} · {data.seller.phone} · @{data.seller.telegram}</p></div></div>}<ListingActivity key={id} id={id} lang={lang} headers={headers} admin initial={data!} onUser={onUser}/></>}</div></dialog>;
}
