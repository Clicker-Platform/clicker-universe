'use client';

import React from 'react';
import { QuickActions } from '@/components/QuickActions';

// MRB templates default to grid layout — all rendering logic lives in QuickActions.
export const MrbQuickActions: React.FC<React.ComponentProps<typeof QuickActions>> = (props) => (
    <QuickActions {...props} defaultLayout="grid" />
);
