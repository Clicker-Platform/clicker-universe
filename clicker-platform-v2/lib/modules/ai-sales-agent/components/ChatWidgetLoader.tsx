'use client';

import dynamic from 'next/dynamic';

const ChatWidget = dynamic(() => import('./ChatWidget').then(mod => mod.ChatWidget), {
    ssr: false
});

interface ChatWidgetLoaderProps {
    siteId: string;
    agentName?: string;
}

export function ChatWidgetLoader(props: ChatWidgetLoaderProps) {
    return <ChatWidget {...props} />;
}
