import { Suspense } from 'react';
import { VerifyClient } from './VerifyClient';

export const dynamic = 'force-dynamic';

export default async function AccountVerifyPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  return (
    <Suspense fallback={null}>
      <VerifyClient tenant={tenant} />
    </Suspense>
  );
}
