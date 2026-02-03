import POSClient from './POSClient';

export const dynamic = 'force-dynamic';

export default async function POSTrackerPage() {
    // Fallback to client-side fetching because Admin SDK credentials are not configured
    // This avoids the "Could not load default credentials" error
    return <POSClient initialOrders={[]} />;
}
