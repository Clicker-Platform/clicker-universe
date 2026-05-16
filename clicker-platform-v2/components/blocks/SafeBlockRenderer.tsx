'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    blockId?: string;
}

interface State {
    hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Block rendering error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div
                    className="p-4 border-2 border-dashed rounded-xl text-sm font-medium text-center my-4"
                    style={{
                        backgroundColor: 'var(--theme-error-bg)',
                        color: 'var(--theme-error)',
                        borderColor: 'var(--theme-error)',
                    }}
                >
                    Something went wrong with this block.
                </div>
            );
        }

        return this.props.children;
    }
}

export const SafeBlockRenderer = ({ children, blockId }: Props) => {
    return (
        <ErrorBoundary blockId={blockId}>
            {children}
        </ErrorBoundary>
    );
};
