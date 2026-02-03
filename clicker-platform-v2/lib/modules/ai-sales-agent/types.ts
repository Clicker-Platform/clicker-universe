export interface AISalesAgentConfig {
    enabled: boolean;
    systemPrompt: string;
    businessContext: string; // Pricing, Offerings, Tone
    model: string; // e.g. "gemini-1.5-flash"
    greetingMessage: string;
    // UI Settings
    fabEnabled: boolean; // Show generic FAB?
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model'; // 'model' to match Gemini, or 'assistant'
    text: string;
    timestamp: number;
}

export interface MessageRequestPayload {
    history: ChatMessage[];
    newMessage: string;
}

export interface SalesLead {
    id: string;
    capturedAt: number;
    email?: string;
    phone?: string;
    name?: string;
    source: 'ai_chat';
    summary: string; // Summary of what they were interested in
}
