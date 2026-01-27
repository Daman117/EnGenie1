import { useRef, useState, useEffect, KeyboardEvent, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Database, Sparkles, AlertCircle, X, Save, LogOut, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from 'react-markdown';
import BouncingDots from '@/components/AIRecommender/BouncingDots';
import { BASE_URL } from "@/components/AIRecommender/api";
import { useAuth } from '@/contexts/AuthContext';
import { MainHeader } from "@/components/MainHeader";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Types for RAG response
interface RAGResponse {
    success: boolean;
    answer: string;
    source: "database" | "llm" | "pending_confirmation" | "user_declined" | "unknown";
    foundInDatabase: boolean;
    awaitingConfirmation: boolean;
    sourcesUsed: string[];
    resultsCount?: number;
    note?: string;
    error?: string;
}

interface ChatMessage {
    id: string;
    type: "user" | "assistant";
    content: string;
    source?: string;
    sourcesUsed?: string[];
    awaitingConfirmation?: boolean;
    timestamp: Date;
}

// UI Labels
interface UILabels {
    loadingText: string;
    confirmationHint: string;
    inputPlaceholder: string;
    sourceDatabase: string;
    sourceLlm: string;
    sourcePending: string;
    errorMessage: string;
}

// MessageRow component with animations
interface MessageRowProps {
    message: ChatMessage;
    isHistory: boolean;
    uiLabels: UILabels;
}

const MessageRow = ({ message, isHistory, uiLabels }: MessageRowProps) => {
    const [isVisible, setIsVisible] = useState(isHistory);

    useEffect(() => {
        if (!isHistory) {
            const delay = message.type === 'user' ? 200 : 0;
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, delay);
            return () => clearTimeout(timer);
        }
    }, [isHistory, message.type]);

    const formatTimestamp = (ts: Date) => {
        try {
            return ts.toLocaleTimeString();
        } catch {
            return '';
        }
    };

    return (
        <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] flex items-start space-x-2 ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${message.type === 'user' ? 'bg-transparent text-white' : 'bg-transparent'}`}>
                    {message.type === 'user' ? (
                        <img src="/icon-user-3d.png" alt="User" className="w-10 h-10 object-contain" />
                    ) : (
                        <img src="/icon-engenie.png" alt="Assistant" className="w-14 h-14 object-contain" />
                    )}
                </div>

                <div className="flex-1">
                    <div
                        className={`break-words ${message.type === 'user' ? 'glass-bubble-user' : 'glass-bubble-assistant'}`}
                        style={{
                            opacity: isVisible ? 1 : 0,
                            transform: isVisible ? 'scale(1)' : 'scale(0.8)',
                            transformOrigin: message.type === 'user' ? 'top right' : 'top left',
                            transition: 'opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                    >
                        <div>
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>

                        {message.awaitingConfirmation && (
                            <div className="mt-2 pt-2 border-t border-yellow-200/50 text-xs text-yellow-700">
                                💡 {uiLabels.confirmationHint}
                            </div>
                        )}
                    </div>

                    <p
                        className={`text-xs text-muted-foreground mt-1 px-1 ${message.type === 'user' ? 'text-right' : ''}`}
                        style={{
                            opacity: isVisible ? 1 : 0,
                            transition: 'opacity 0.8s ease 0.3s'
                        }}
                    >
                        {formatTimestamp(message.timestamp)}
                    </p>
                </div>
            </div>
        </div>
    );
};

// Default UI labels
const DEFAULT_UI_LABELS: UILabels = {
    loadingText: "Searching database...",
    confirmationHint: "Type 'Yes' for AI answer, or 'No' to skip",
    inputPlaceholder: "Ask about products, vendors, or specifications...",
    sourceDatabase: "From Database",
    sourceLlm: "From AI Knowledge",
    sourcePending: "Awaiting Your Response",
    errorMessage: "Sorry, something went wrong. Please try again."
};

// IndexedDB for state persistence
const ENGENIE_CHAT_DB_NAME = 'engenie_chat_db';
const ENGENIE_CHAT_STORE_NAME = 'engenie_chat_state';
const ENGENIE_CHAT_STATE_KEY = 'current_session';
const ENGENIE_CHAT_BACKUP_KEY = 'engenie_chat_state_backup';

const openEnGenieChatDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(ENGENIE_CHAT_DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(ENGENIE_CHAT_STORE_NAME)) {
                db.createObjectStore(ENGENIE_CHAT_STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

const saveStateToEnGenieChatDB = async (state: any): Promise<void> => {
    try {
        const db = await openEnGenieChatDB();
        const transaction = db.transaction(ENGENIE_CHAT_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(ENGENIE_CHAT_STORE_NAME);
        await new Promise<void>((resolve, reject) => {
            const request = store.put({ id: ENGENIE_CHAT_STATE_KEY, ...state });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        db.close();
    } catch (e) {
        console.warn('[ENGENIE_CHAT] Failed to save to IndexedDB:', e);
    }
};

const loadStateFromEnGenieChatDB = async (): Promise<any | null> => {
    try {
        const db = await openEnGenieChatDB();
        const transaction = db.transaction(ENGENIE_CHAT_STORE_NAME, 'readonly');
        const store = transaction.objectStore(ENGENIE_CHAT_STORE_NAME);
        const result = await new Promise<any>((resolve, reject) => {
            const request = store.get(ENGENIE_CHAT_STATE_KEY);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        db.close();
        if (result?.messages) {
            result.messages = result.messages.map((msg: any) => ({
                ...msg,
                timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined
            }));
        }
        return result || null;
    } catch (e) {
        console.warn('[ENGENIE_CHAT] Failed to load from IndexedDB:', e);
        return null;
    }
};

const clearEnGenieChatDBState = async (): Promise<void> => {
    try {
        const db = await openEnGenieChatDB();
        const transaction = db.transaction(ENGENIE_CHAT_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(ENGENIE_CHAT_STORE_NAME);
        await new Promise<void>((resolve, reject) => {
            const request = store.delete(ENGENIE_CHAT_STATE_KEY);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        db.close();
        localStorage.removeItem(ENGENIE_CHAT_BACKUP_KEY);
    } catch (e) {
        console.warn('[ENGENIE_CHAT] Failed to clear IndexedDB:', e);
    }
};

const EnGenieChat = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, logout } = useAuth();

    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showThinking, setShowThinking] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [sessionId, setSessionId] = useState(() => `engenie_chat_${Date.now()}`);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);
    const [isHistory, setIsHistory] = useState(false);
    const [uiLabels] = useState<UILabels>(DEFAULT_UI_LABELS);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const stateRef = useRef({ messages: [] as ChatMessage[], sessionId: '' });

    useEffect(() => {
        stateRef.current = { messages, sessionId };
    }, [messages, sessionId]);

    // Auto-scroll
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, showThinking]);

    // Convert snake_case to camelCase
    const toCamelCase = (obj: any): any => {
        if (Array.isArray(obj)) return obj.map(v => toCamelCase(v));
        if (obj !== null && typeof obj === 'object') {
            return Object.keys(obj).reduce((acc: Record<string, any>, key: string) => {
                const camelKey = key.replace(/([-_][a-z])/g, (g) => g.toUpperCase().replace("-", "").replace("_", ""));
                acc[camelKey] = toCamelCase(obj[key]);
                return acc;
            }, {});
        }
        return obj;
    };

    // Save on unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            const stateToSave = {
                messages: stateRef.current.messages,
                sessionId: stateRef.current.sessionId,
                savedAt: new Date().toISOString()
            };
            try {
                localStorage.setItem(ENGENIE_CHAT_BACKUP_KEY, JSON.stringify(stateToSave));
            } catch (e) { }
            saveStateToEnGenieChatDB(stateToSave);
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // Load state on mount
    useEffect(() => {
        // If coming from a project, skip this
        if (searchParams.get('projectId')) return;

        // If there's a query parameter, this is a NEW session - don't load old state
        const queryFromUrl = searchParams.get('query');
        if (queryFromUrl) {
            console.log('[ENGENIE_CHAT] New session with query - starting fresh');
            // Generate new session ID for this fresh conversation
            setSessionId(`engenie_chat_${Date.now()}`);
            // Clear any old state
            clearEnGenieChatDBState();
            localStorage.removeItem(ENGENIE_CHAT_BACKUP_KEY);
            return;
        }

        // Check if we should load a specific saved session
        const savedSessionId = searchParams.get('sessionId');
        if (savedSessionId) {
            console.log('[ENGENIE_CHAT] Loading specific saved session:', savedSessionId);
            const loadSavedSession = async () => {
                try {
                    const restoredState = await loadStateFromEnGenieChatDB();
                    if (restoredState?.sessionId === savedSessionId && restoredState?.messages?.length > 0) {
                        const restoredMessages = restoredState.messages.map((msg: any) => ({
                            ...msg,
                            timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined
                        }));
                        setMessages(restoredMessages);
                        setSessionId(savedSessionId);
                        setHasAutoSubmitted(true);
                        setIsHistory(true);
                        console.log('[ENGENIE_CHAT] Restored saved session with', restoredMessages.length, 'messages');
                    } else {
                        console.log('[ENGENIE_CHAT] Saved session not found, starting fresh');
                    }
                } catch (e) {
                    console.error('[ENGENIE_CHAT] Failed to load saved session:', e);
                }
            };
            loadSavedSession();
            return;
        }

        // No query and no sessionId - start completely fresh
        console.log('[ENGENIE_CHAT] Opening fresh - starting new session');
        setSessionId(`engenie_chat_${Date.now()}`);
        setMessages([]);
        setHasAutoSubmitted(false);
        setIsHistory(false);

        // Optionally clear old state to prevent buildup
        clearEnGenieChatDBState();
        localStorage.removeItem(ENGENIE_CHAT_BACKUP_KEY);
    }, [searchParams]);

    // Query API - defined first so it can be used by auto-submit
    const queryEnGenieChat = async (query: string): Promise<RAGResponse> => {
        try {
            const response = await axios.post("/api/engenie-chat/query", {
                query,
                session_id: sessionId
            }, { withCredentials: true });
            return toCamelCase(response.data) as RAGResponse;
        } catch (error: any) {
            return {
                success: false,
                answer: error.response?.data?.answer || uiLabels.errorMessage,
                source: "unknown",
                foundInDatabase: false,
                awaitingConfirmation: false,
                sourcesUsed: [],
                error: error.message
            };
        }
    };

    // Handle incoming query from URL parameter (from workflow routing)
    useEffect(() => {
        const queryFromUrl = searchParams.get('query');
        if (queryFromUrl && !hasAutoSubmitted && messages.length === 0) {
            console.log('[ENGENIE_CHAT] Auto-submitting query from URL:', queryFromUrl.substring(0, 50) + '...');
            setHasAutoSubmitted(true);

            // Define and execute auto-submit inline
            const autoSubmit = async () => {
                const userMessage: ChatMessage = {
                    id: `user_${Date.now()}`,
                    type: "user",
                    content: queryFromUrl,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, userMessage]);
                setIsLoading(true);
                setShowThinking(true);

                try {
                    const response = await queryEnGenieChat(queryFromUrl);
                    setShowThinking(false);

                    const assistantMessage: ChatMessage = {
                        id: `assistant_${Date.now()}`,
                        type: "assistant",
                        content: response.answer,
                        source: response.source,
                        sourcesUsed: response.sourcesUsed,
                        awaitingConfirmation: response.awaitingConfirmation,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, assistantMessage]);

                    if (response.source === "database") {
                        toast({
                            title: uiLabels.sourceDatabase,
                            description: response.sourcesUsed?.join(", ") || "database",
                        });
                    } else if (response.source === "llm") {
                        toast({
                            title: uiLabels.sourceLlm,
                            description: "AI knowledge",
                        });
                    }
                } catch (error) {
                    setShowThinking(false);
                    toast({
                        title: "Error",
                        description: uiLabels.errorMessage,
                        variant: "destructive",
                    });
                } finally {
                    setIsLoading(false);
                }
            };

            // Execute after short delay to ensure component is mounted
            setTimeout(autoSubmit, 100);
        }
    }, [searchParams, hasAutoSubmitted, messages.length, sessionId, toast, uiLabels]);

    const submitQuery = async (query: string) => {
        const userMessage: ChatMessage = {
            id: `user_${Date.now()}`,
            type: "user",
            content: query,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);
        setInputValue("");
        setIsLoading(true);
        setShowThinking(true);

        try {
            const response = await queryEnGenieChat(query);
            setShowThinking(false);

            const assistantMessage: ChatMessage = {
                id: `assistant_${Date.now()}`,
                type: "assistant",
                content: response.answer,
                source: response.source,
                sourcesUsed: response.sourcesUsed,
                awaitingConfirmation: response.awaitingConfirmation,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, assistantMessage]);

            if (response.source === "database") {
                toast({
                    title: uiLabels.sourceDatabase,
                    description: response.sourcesUsed?.join(", ") || "database",
                });
            } else if (response.source === "llm") {
                toast({
                    title: uiLabels.sourceLlm,
                    description: "AI knowledge",
                });
            }
        } catch (error) {
            setShowThinking(false);
            toast({
                title: "Error",
                description: uiLabels.errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        const trimmedInput = inputValue.trim();
        if (!trimmedInput) return;
        await submitQuery(trimmedInput);
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleSend();
    };

    const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            toast({ title: "Logout Failed", variant: "destructive" });
        }
    };

    const handleNewSession = async () => {
        await clearEnGenieChatDBState();
        setMessages([]);
        setSessionId(`engenie_chat_${Date.now()}`);
        setHasAutoSubmitted(false);
        setIsHistory(false);
        toast({ title: "New Session", description: "Started fresh session" });
    };

    const profileButtonLabel = user?.name || user?.username || "User";

    return (
        <div className="h-screen w-full app-glass-gradient flex flex-col overflow-hidden relative">
            <MainHeader
                rightContent={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleNewSession}>
                            New Session
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    {profileButtonLabel}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                                    Dashboard
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate('/solution')}>
                                    Projects
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout}>
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Logout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                }
                centerContent={
                    <h1 className="text-2xl font-bold text-[#0f172a] flex items-center gap-3">
                        Engenie <span className="text-primary text-2xl leading-none pt-1">♦</span> Chat
                    </h1>
                }
            />

            {/* Chat Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 pt-24 space-y-4 custom-no-scrollbar pb-24">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <img src="/icon-engenie.png" alt="EnGenie" className="w-24 h-24 mb-4 opacity-50" />
                        <h2 className="text-xl font-semibold text-muted-foreground mb-2">Welcome to EnGenie Chat</h2>
                        <p className="text-muted-foreground max-w-md">
                            Ask me about products, specifications, vendors, or any industrial instrumentation questions.
                        </p>
                    </div>
                )}
                {messages.map((message) => (
                    <MessageRow
                        key={message.id}
                        message={message}
                        isHistory={isHistory}
                        uiLabels={uiLabels}
                    />
                ))}

                {showThinking && (
                    <div className="flex justify-start">
                        <div className="max-w-[80%] flex items-start space-x-2">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-transparent">
                                <img src="/icon-engenie.png" alt="Assistant" className="w-14 h-14 object-contain" />
                            </div>
                            <div className="p-3 rounded-lg">
                                <BouncingDots />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-transparent z-30 pointer-events-none">
                <div className="max-w-4xl mx-auto px-2 md:px-8 pointer-events-auto">
                    <form onSubmit={handleSubmit}>
                        <div className="relative group">
                            <div
                                className="relative w-full rounded-[26px] transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/50"
                                style={{
                                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                                    backdropFilter: 'blur(12px)',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid rgba(255, 255, 255, 0.4)',
                                }}
                            >
                                <textarea
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    onInput={(e) => {
                                        const target = e.target as HTMLTextAreaElement;
                                        target.style.height = 'auto';
                                        target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
                                    }}
                                    className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none px-4 py-2.5 pr-20 text-sm resize-none min-h-[40px] max-h-[150px]"
                                    style={{ fontSize: '16px' }}
                                    placeholder={uiLabels.inputPlaceholder}
                                    disabled={isLoading}
                                />
                                <div className="absolute bottom-1.5 right-1.5">
                                    <Button
                                        type="submit"
                                        disabled={!inputValue.trim() || isLoading}
                                        className="w-8 h-8 p-0 rounded-full"
                                        variant="ghost"
                                        size="icon"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        ) : (
                                            <Send className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EnGenieChat;
