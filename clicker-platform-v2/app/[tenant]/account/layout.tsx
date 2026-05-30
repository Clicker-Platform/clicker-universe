import { AccountShell } from '@/components/account/AccountShell';
import { getTenantBrand } from '@/lib/account/brand';

export const dynamic = 'force-dynamic';

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const brand = await getTenantBrand(tenant);
  return (
    <AccountShell tenant={tenant} brand={brand}>
      {children}
    </AccountShell>
  );
}
