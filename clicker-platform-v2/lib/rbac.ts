export type Role = 'owner' | 'editor' | 'viewer'; // simplified

export const PERMISSIONS = {
    manage_site: ['owner'],
    manage_users: ['owner'],
    manage_content: ['owner', 'editor'],
    view_analytics: ['owner', 'editor', 'viewer'],
} as const;

export function hasPermission(role: Role, permission: keyof typeof PERMISSIONS): boolean {
    if (!role) return false;
    return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const ROLES = {
    OWNER: 'owner',
    EDITOR: 'editor',
    VIEWER: 'viewer',
} as const;
