'use client';

import React from 'react';
import { DefaultQuickActionsBlock as QuickActions } from '@/components/blocks/public/DefaultQuickActionsBlock';

// MRB templates default to grid layout — all rendering logic lives in QuickActions.
export const MrbQuickActions: React.FC<React.ComponentProps<typeof QuickActions>> = (props) => (
    <QuickActions {...props} defaultLayout="grid" />
);
