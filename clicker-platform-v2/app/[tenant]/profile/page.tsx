import { redirect } from 'next/navigation';
import { adminAuth } from '@/lib/firebase-admin';
import { getBuyerAdmin } from '@/lib/modules/digital_goods/server-api';
import { publicRoutes } from '@/lib/modules/digital_goods/constants';
import { getBuyerSessionCookie } from '@/lib/modules/digital_goods/session';
import { ProfileClient } from './ProfileClient';

export const revalidate = 0;

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const siteId = tenant;
  const routes = publicRoutes(tenant);

  const sessionCookie = await getBuyerSessionCookie();
  if (!sessionCookie) redirect(`${routes.login}?next=${encodeURIComponent(routes.profile)}`);

  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.profile)}`);
  }

  const buyer = await getBuyerAdmin(siteId, decoded!.uid);
  const initialEmail = buyer?.email ?? decoded!.email ?? '';
  const initialFullName = buyer?.fullName ?? '';

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Profil</h1>
        <ProfileClient
          tenant={tenant}
          initialEmail={initialEmail}
          initialFullName={initialFullName}
        />
      </div>
    </main>
  );
}
