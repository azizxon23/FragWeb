import AdminPortal from './portal';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'FragWeb — Admin portal', robots: { index: false, follow: false } };
export default function AdminPage() { return <AdminPortal />; }
