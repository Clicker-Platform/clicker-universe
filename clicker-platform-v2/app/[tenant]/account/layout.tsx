import { MemberShell } from '@/components/account/MemberShell';

export const dynamic = 'force-dynamic';

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  return <MemberShell tenant={tenant}>{children}</MemberShell>;
}
