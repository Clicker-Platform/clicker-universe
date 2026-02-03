import { useUser } from '@/lib/user-context';
import { toast } from 'sonner';

interface UsePermissionResult {
    canEdit: boolean;
    canView: boolean;
    checkAccess: (action?: 'edit' | 'view') => boolean;
}

/**
 * Hook to check permissions for a specific module/route.
 * Provides accessible booleans and a helper to show Toasts on denial.
 */
export function usePermission(moduleId: string, routeId: string = 'default'): UsePermissionResult {
    const { canEdit: checkEdit, hasAccess: checkView, isOwner } = useUser();

    const canEdit = checkEdit(moduleId, routeId);
    const canView = checkView(moduleId, routeId);

    const checkAccess = (action: 'edit' | 'view' = 'edit') => {
        if (action === 'edit') {
            if (!canEdit) {
                toast.info("View Only Mode", {
                    description: "You strictly have view-only access based on your role."
                });
                return false;
            }
            return true;
        } else {
            if (!canView) {
                toast.warning("Restricted Access", {
                    description: "You do not have permission to access."
                });
                return false;
            }
            return true;
        }
    };

    return {
        canEdit,
        canView,
        checkAccess
    };
}
