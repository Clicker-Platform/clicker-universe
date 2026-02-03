import { isModuleEnabled } from '@/lib/modules/registry';
import LoginPage from '@/lib/modules/membership/components/public/LoginPage';

export const dynamic = 'force-dynamic';

export default async function Page() {
    const isEnabled = await isModuleEnabled('membership');

    if (!isEnabled) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center text-gray-500">
                <h1 className="text-xl font-bold mb-2">Member Login Unavailable</h1>
                <p>The membership module is currently disabled.</p>
            </div>
        );
    }

    return <LoginPage />;
}
