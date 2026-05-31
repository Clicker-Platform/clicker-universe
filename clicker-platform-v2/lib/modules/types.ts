export interface AdminRoute {
    path: string;
    label: string;
    icon?: string; // Key for the icon map
    componentKey?: string; // If set, handled by Dynamic Router
    hidden?: boolean; // If true, hide from sidebar
    permission?: string; // Optional permission requirement (e.g. 'manage_team')
}

export interface PublicRouteDefinition {
    path: string; // e.g., "/order"
    componentKey: string; // e.g., "OrderPage" - references key in component map
}

export interface MemberSurfaceContext {
  siteId: string;
  uid: string;
}

export interface MemberSurfaceDefinition {
  id: string;                 // unique surface id, e.g. 'library'
  label: string;              // sidebar label, e.g. "My Library"
  icon: string;               // icon key (same icon-map keys as AdminRoute.icon)
  route: string;              // e.g. '/library' → mounts at /[tenant]/account/library
  componentKey: string;       // key in the client component registry
  // Explicit grant. If set, it decides visibility. If unset, falls back to hasData/dataCheck.
  isGranted?: (ctx: MemberSurfaceContext) => boolean | Promise<boolean>;
  // Implicit-by-data check (client-SDK-safe predicate) used when isGranted is unset.
  hasData?: (ctx: MemberSurfaceContext) => boolean | Promise<boolean>;
  // Server-only implicit-by-data check, identified by key. Used when the data check
  // needs the admin SDK (so it can't live as a function in this client-imported file).
  // The server-only surface resolver maps the key → an admin-SDK predicate.
  // If isGranted, hasData, AND dataCheck are all unset, the surface is hidden.
  dataCheck?: string;
}

export interface ModuleDefinition {
    id: string;
    displayName: string;
    description?: string;
    icon: string; // specialized icon key for the module itself
    version: string;
    enabled: boolean;

    adminRoutes?: AdminRoute[];
    publicRoutes?: PublicRouteDefinition[]; // Renamed to avoid confusion with internal PublicRoute interface if any

    // Capabilities
    collections?: string[]; // Firestore collections this module owns
    requires?: string[]; // IDs of other modules this module depends on
    blocks?: ModuleBlockDefinition[]; // Custom blocks provided by this module
    memberSurface?: MemberSurfaceDefinition; // account-dashboard surface (member-tier spec 2026-05-29)
    dashboardWidgets?: ModuleWidgetDefinition[]; // Widgets for Member Dashboard
    settings?: Record<string, any>; // Module-specific configuration
    dashboardAction?: {
        label: string;
        href: string;
    };
    adminDashboardWidget?: {
        componentKey: string;
    };
}

export interface ModuleWidgetDefinition {
    location: string; // e.g., 'member_dashboard'
    componentKey: string; // Key in MODULE_COMPONENTS
    priority?: number; // Sorting order

}

export interface ModuleBlockDefinition {
    type: string; // The blockType string, e.g. "reservation_cta"
    label: string; // Display label for the editor
    componentKey: string; // Key in MODULE_COMPONENTS to render this block
}

// For future use when we permit configuration via DB
export interface ModuleConfig {
    moduleId: string;
    settings: Record<string, any>;
}
