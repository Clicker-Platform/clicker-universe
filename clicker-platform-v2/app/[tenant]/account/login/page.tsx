import { LoginClient } from './LoginClient';

export const dynamic = 'force-dynamic';

export default async function AccountLoginPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  return <LoginClient tenant={tenant} />;
}
