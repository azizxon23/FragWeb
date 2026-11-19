import AccountAccess from './access';
export const metadata={title:'FragWeb — Account'};
export default async function AccountPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams;
  const initialMode=params.mode==='signup'?'signup':params.mode==='setup'?'setup':'login';
  return <AccountAccess initialMode={initialMode}/>;
}
