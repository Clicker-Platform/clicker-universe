import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth } from '@/lib/firebase-admin';
import { getBuyerAdmin } from '@/lib/modules/digital_goods/server-api';
import { publicRoutes } from '@/lib/modules/digital_goods/constants';
import { OnboardingClient } from './OnboardingClient';

export const revalidate = 0;

export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { tenant } = await params;
  const { next: rawNext } = await searchParams;
  const siteId = tenant;
  const routes = publicRoutes(tenant);

  const safeNext = (rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//'))
    ? rawNext
    : routes.store;

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`${routes.login}?next=${encodeURIComponent(routes.onboarding)}`);

  let decoded;
  try {
    decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.onboarding)}`);
  }

  const buyer = await getBuyerAdmin(siteId, decoded!.uid);

  // Already onboarded — bounce to the requested next page.
  if (buyer?.fullName && buyer.fullName.trim().length > 0) {
    redirect(safeNext);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Lengkapi profil kamu</h1>
          <p className="text-sm text-gray-500 mt-1">Hanya sekali. Setelah ini kamu langsung bisa belanja.</p>
        </div>
        <OnboardingClient
          tenant={tenant}
          email={buyer?.email ?? decoded!.email ?? ''}
          nextUrl={safeNext}
        />
      </div>
    </main>
  );
}
