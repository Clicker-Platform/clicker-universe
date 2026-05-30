import { AccountShell } from '@/components/account/AccountShell';
import { AccountAuthProvider } from '@/components/account/AccountAuthProvider';
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
    <AccountAuthProvider>
      <AccountShell tenant={tenant} brand={brand}>
        {children}
      </AccountShell>
    </AccountAuthProvider>
  );
}
