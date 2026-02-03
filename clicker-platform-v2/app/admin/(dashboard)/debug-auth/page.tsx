'use client';

import { useUser } from '@/lib/user-context';
import { useSite } from '@/lib/site-context';

export default function DebugAuthPage() {
    const { user, role, permissions, moduleAccess, hasAccess, getAccessLevel } = useUser();
    const { siteId } = useSite();

    return (
        <div className="p-10 bg-white">
            <h1 className="text-2xl font-bold mb-4">Auth Debugger</h1>

            <div className="space-y-4">
                <div className="p-4 border rounded bg-gray-50">
                    <h2 className="font-bold">User Identity</h2>
                    <pre>{JSON.stringify({ uid: user?.uid, email: user?.email, siteId }, null, 2)}</pre>
                </div>

                <div className="p-4 border rounded bg-gray-50">
                    <h2 className="font-bold">Role & Permissions</h2>
                    <p>Role: <strong>{role}</strong></p>
                    <p>Permissions: <strong>{JSON.stringify(permissions)}</strong></p>
                </div>

                <div className="p-4 border rounded bg-gray-50">
                    <h2 className="font-bold">Module Access (Raw)</h2>
                    <pre>{JSON.stringify(moduleAccess, null, 2)}</pre>
                </div>

                <div className="p-4 border rounded bg-blue-50">
                    <h2 className="font-bold text-blue-800">Permission Tests</h2>
                    <table className="w-full text-left mt-2">
                        <thead>
                            <tr className="border-b">
                                <th>Check</th>
                                <th>Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>hasAccess('byod_pos', 'settings')</td>
                                <td>{hasAccess('byod_pos', 'settings') ? 'TRUE' : 'FALSE'}</td>
                            </tr>
                            <tr>
                                <td>getAccessLevel('byod_pos', 'settings')</td>
                                <td>{getAccessLevel('byod_pos', 'settings')}</td>
                            </tr>
                            <tr>
                                <td>hasAccess('pos', 'settings')</td>
                                <td>{hasAccess('pos', 'settings') ? 'TRUE' : 'FALSE'}</td>
                            </tr>
                            <tr>
                                <td>getAccessLevel('pos', 'settings')</td>
                                <td>{getAccessLevel('pos', 'settings')}</td>
                            </tr>
                            <tr>
                                <td>hasAccess('byod_pos', 'configuration')</td>
                                <td>{hasAccess('byod_pos', 'configuration') ? 'TRUE' : 'FALSE'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
