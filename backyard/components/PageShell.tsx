import Sidebar from '@/components/Sidebar';

interface PageShellProps {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}

export default function PageShell({ title, subtitle, action, children }: PageShellProps) {
    return (
        <div className="min-h-screen bg-gray-50/50 flex font-sans">
            <Sidebar />
            <div className="flex-1 ml-64 p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-black text-brand-dark">{title}</h1>
                            {subtitle && <p className="text-sm text-gray-400 font-medium mt-0.5">{subtitle}</p>}
                        </div>
                        {action && <div>{action}</div>}
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
