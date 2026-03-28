'use client';

import { createContext, useContext, ReactNode } from 'react';

export type DeviceView = 'mobile' | 'tablet' | 'desktop' | 'responsive';

const DeviceViewContext = createContext<DeviceView>('responsive');

export function DeviceViewProvider({ deviceView, children }: { deviceView: DeviceView; children: ReactNode }) {
    return <DeviceViewContext.Provider value={deviceView}>{children}</DeviceViewContext.Provider>;
}

export function useDeviceView(): DeviceView {
    return useContext(DeviceViewContext);
}

/**
 * Returns the appropriate class string based on device view.
 *
 * On the public site (deviceView = 'responsive'), returns both mobile + desktop
 * classes so Tailwind breakpoints work normally.
 *
 * In the canvas preview, returns only the classes for the selected device.
 *
 * Usage: dv(deviceView, 'flex-col', 'md:flex-row')
 *   → responsive: 'flex-col md:flex-row'  (normal Tailwind)
 *   → mobile:     'flex-col'
 *   → tablet:     tablet arg, or desktop fallback
 *   → desktop:    'flex-col md:flex-row'  (both, md: applies in real viewport)
 */
export function dv(
    deviceView: DeviceView,
    mobile: string,
    desktop: string,
    tablet?: string
): string {
    if (deviceView === 'responsive') return `${mobile} ${desktop}`;
    if (deviceView === 'mobile') return mobile;
    if (deviceView === 'tablet') return tablet ?? desktop;
    return `${mobile} ${desktop}`; // desktop: include both so md: classes apply
}
