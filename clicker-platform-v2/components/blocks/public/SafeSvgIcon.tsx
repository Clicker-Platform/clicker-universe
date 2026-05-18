import React from 'react';
import { sanitizeSvgIcon } from '@/lib/sanitizeSvgIcon';

interface SafeSvgIconProps {
    svg: string;
    className?: string;
    'aria-hidden'?: boolean;
}

// Renders raw SVG markup after passing it through sanitizeSvgIcon (DOMPurify).
// Isolates the inline-HTML injection to one well-tested call site.
// Do NOT use this component with any string that has not already been routed
// through sanitizeSvgIcon — useMemo here re-runs the sanitizer on every prop
// change, so passing raw user input is safe by construction.
export const SafeSvgIcon: React.FC<SafeSvgIconProps> = ({ svg, className, 'aria-hidden': ariaHidden = true }) => {
    const safe = React.useMemo(() => sanitizeSvgIcon(svg), [svg]);
    if (!safe) return null;
    return (
        <span
            className={className}
            aria-hidden={ariaHidden}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            // eslint-disable-next-line react/no-danger -- safe: sanitized by sanitizeSvgIcon (DOMPurify + SVG allowlist) on every render via useMemo above
            dangerouslySetInnerHTML={{ __html: safe }}
        />
    );
};
