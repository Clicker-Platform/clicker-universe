import { AdminSidebar } from './AdminSidebar';
import AdminGuard from '@/components/admin/AdminGuard';
import { UserProvider } from '@/lib/user-context';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminGuard>
            <UserProvider>
                <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
                    <AdminSidebar />

                    {/* Main Content */}
                    <main className="flex-1 p-4 md:p-8 min-w-0 overflow-x-hidden">
                        {children}
                    </main>
                </div>
            </UserProvider>
        </AdminGuard>
    );
}
