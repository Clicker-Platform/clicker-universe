'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type FilterStatus = 'all' | 'new' | 'read' | 'archived';
type PanelTab = 'inbox' | 'notifications';

interface InboxPanelState {
    isOpen: boolean;
    activeTab: PanelTab;
    filterStatus: FilterStatus;
    selectedSubmissionId: string | null;
    open: (opts?: { tab?: PanelTab; filter?: FilterStatus; submissionId?: string }) => void;
    close: () => void;
    setFilter: (f: FilterStatus) => void;
    selectSubmission: (id: string | null) => void;
}

const InboxPanelContext = createContext<InboxPanelState | undefined>(undefined);

export function InboxPanelProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<PanelTab>('inbox');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

    const open = useCallback((opts?: { tab?: PanelTab; filter?: FilterStatus; submissionId?: string }) => {
        setIsOpen(true);
        if (opts?.tab) setActiveTab(opts.tab);
        if (opts?.filter) setFilterStatus(opts.filter);
        if (opts?.submissionId) setSelectedSubmissionId(opts.submissionId);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setSelectedSubmissionId(null);
    }, []);

    const setFilter = useCallback((f: FilterStatus) => {
        setFilterStatus(f);
        setSelectedSubmissionId(null);
    }, []);

    const selectSubmission = useCallback((id: string | null) => {
        setSelectedSubmissionId(id);
    }, []);

    return (
        <InboxPanelContext.Provider value={{
            isOpen, activeTab, filterStatus, selectedSubmissionId,
            open, close, setFilter, selectSubmission
        }}>
            {children}
        </InboxPanelContext.Provider>
    );
}

export function useInboxPanel() {
    const context = useContext(InboxPanelContext);
    if (context === undefined) {
        throw new Error('useInboxPanel must be used within an InboxPanelProvider');
    }
    return context;
}
