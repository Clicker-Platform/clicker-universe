'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Minus } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ChatMessage } from '../types';
import { logger } from '@/lib/logger';

interface ChatWidgetProps {
    siteId: string;
    moduleId?: string;
    agentName?: string;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ siteId, moduleId, agentName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState<any>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Load Config (Public Settings)
    useEffect(() => {
        if (!siteId) return;

        // Use site-scoped path: sites/{siteId}/modules/ai_sales
        const unsub = onSnapshot(doc(db, 'sites', siteId, 'modules', 'ai_sales'), (doc) => {
            if (doc.exists()) {
                setConfig(doc.data());
                // Set initial greeting
                if (messages.length === 0 && doc.data().greetingMessage) {
                    setMessages([{
                        id: 'greeting',
                        role: 'model',
                        text: doc.data().greetingMessage,
                        timestamp: Date.now()
                    }]);
                }
            }
        });
        return () => unsub();
    }, [siteId, messages.length]);

    // 2. Listen for Global Trigger Events (from BottomNavBar or other buttons)
    useEffect(() => {
        const handleOpenParams = () => setIsOpen(true);
        window.addEventListener('ai-sales-agent:open', handleOpenParams);
        return () => window.removeEventListener('ai-sales-agent:open', handleOpenParams);
    }, []);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/ai-sales-agent/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-site-id': siteId // Pass siteId in header
                },
                body: JSON.stringify({
                    history: messages, // Send history WITHOUT new message (Gemini appends it via newMessage)
                    newMessage: userMsg.text
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                logger.error('ai.agent.chat.api.error', { siteId, error: errorData });
                throw new Error(errorData.details || errorData.error || "Failed to send message");
            }

            const data = await response.json();

            const botMsg: ChatMessage = {
                id: Date.now().toString() + '_bot',
                role: 'model',
                text: data.response,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, botMsg]);

        } catch (error) {
            logger.error('ai.agent.chat.send.failed', { siteId, error });
            // Optional: Add error message to chat
        } finally {
            setIsLoading(false);
        }
    };

    if (!config?.enabled) return null;

    return (
        <>
            {/* Desktop Bubble - Hidden on Mobile */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="
                        flex
                        fixed bottom-6 right-6 z-50
                        w-14 h-14 rounded-full
                        items-center justify-center
                        bg-black text-white shadow-xl
                        hover:scale-105 transition-transform
                        border-2 border-white/20
                    "
                >
                    <MessageSquare size={24} />
                    {/* Optional Notification Dot could go here */}
                </button>
            )}

            {/* Chat Window - Shared Mobile/Desktop */}
            {isOpen && (
                <div className="
                    fixed z-[60] 
                    bottom-0 right-0 left-0 top-0 md:top-auto md:left-auto md:bottom-24 md:right-6
                    md:w-[400px] md:h-[600px] md:rounded-2xl
                    bg-white shadow-2xl flex flex-col overflow-hidden
                    md:border border-gray-200
                ">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-theme-primary/10 flex items-center justify-center text-theme-primary">
                                <MessageSquare size={16} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">{agentName || 'Sales Assistant'}</h3>
                                <p className="text-xs text-green-600 font-medium">Online</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg md:hidden">
                                <Minus size={20} />
                            </button>
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`
                                    max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed
                                    ${msg.role === 'user'
                                        ? 'bg-black text-white rounded-br-sm'
                                        : 'bg-white border border-gray-200 shadow-sm text-gray-800 rounded-bl-sm'}
                                `}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-white border-t border-gray-100 pb-safe-bottom">
                        <form onSubmit={handleSendMessage} className="relative">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Write a message..."
                                className="w-full pl-4 pr-12 py-3 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};
