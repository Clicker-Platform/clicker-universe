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
    dashboardWidgets?: ModuleWidgetDefinition[]; // Widgets for Member Dashboard
    settings?: Record<string, any>; // Module-specific configuration
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
