import { LoginClient } from './LoginClient';
import { getTenantBrand } from '@/lib/account/brand';

export const dynamic = 'force-dynamic';

export default async function AccountLoginPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const brand = await getTenantBrand(tenant);
  return <LoginClient tenant={tenant} brand={brand} />;
}
