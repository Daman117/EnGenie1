import { useRef, useState, useEffect, KeyboardEvent, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Database, Sparkles, AlertCircle, X, Save, LogOut, User, FileText, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from 'react-markdown';
import BouncingDots from '@/components/AIRecommender/BouncingDots';
import { BASE_URL } from "@/components/AIRecommender/api";
import { useAuth } from '@/contexts/AuthContext';
import { MainHeader } from "@/components/MainHeader";
import { useScreenPersistence } from '@/hooks/use-screen-persistence';
import { useMemo } from 'react';
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

// Persistent storage setup happens via hook now

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

    // ONLOAD function for restoring Date objects
    const onLoad = useMemo(() => (state: any) => {
        if (state.messages) {
            state.messages = state.messages.map((msg: any) => ({
                ...msg,
                timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined
            }));
        }
        return state;
    }, []);

    // CONFIG: Persistence Hook
    const { saveState, loadState, clearState } = useScreenPersistence(stateRef, {
        dbName: 'engenie_chat_db',
        storeName: 'engenie_chat_state',
        key: 'current_session',
        backupKey: 'engenie_chat_state_backup',
        enableAutoSave: true,
        onLoad
    });

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

    // Save on unload: handled by useScreenPersistence hook now
    // We can keep the manual save on unmount/unload logic here IF the hook logic doesn't cover it or we want to double check
    // But the hook already handles 'beforeunload'.
    // The previous implementation also had a manual write to LocalStorage; the hook does both.

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
            clearState();
            return;
        }

        // Check if we should load a specific saved session
        const savedSessionId = searchParams.get('sessionId');
        if (savedSessionId) {
            console.log('[ENGENIE_CHAT] Loading specific saved session:', savedSessionId);
            const loadSavedSession = async () => {
                try {
                    const restoredState: any = await loadState();
                    if (restoredState?.sessionId === savedSessionId && restoredState?.messages?.length > 0) {
                        setMessages(restoredState.messages);
                        setSessionId(savedSessionId);
                        setHasAutoSubmitted(true);
                        setIsHistory(true);
                        console.log('[ENGENIE_CHAT] Restored saved session with', restoredState.messages.length, 'messages');
                    } else {
                        console.log('[ENGENIE_CHAT] Saved session not found, starting fresh');
                        // No logic to prevent overwriting if we just start fresh with same ID? 
                        // Actually if we start fresh we might be unrelated to that ID.
                    }
                } catch (e) {
                    console.error('[ENGENIE_CHAT] Failed to load saved session:', e);
                }
            };
            loadSavedSession();
            return;
        }

        // No query and no sessionId - start completely fresh
        // BUT wait! If we have a saved "current session" we should probably load it?
        // The original code started fresh unless there was a sessionId param?
        // Let's check original behavior:
        // "No query and no sessionId - start completely fresh ... clearEnGenieChatDBState()"
        // So the default behavior is to wipe previous state on a fresh visit? 
        // That seems aggressive for "persistence". usually persistence means "I reload and my stuff is there".
        // However, looking at the previous code:
        //    if (queryFromUrl) { ... clear... }
        //    if (savedSessionId) { ... load ... }
        //    else { ... clear ... }

        // Wait, if I just refresh the page, I have no query and no sessionId params usually (unless they persist in URL).
        // If the URL is clean `/chat`, the original code wipes everything!
        // That means the "Persistence" was only effective if I manually saved and got a link?
        // OR... maybe `ENGENIE_CHAT_STATE_KEY` is just 'current_session'. 

        // Actually, for a true "Screen Level Persistence" (auto-save), we WANT to restore on refresh.
        // If the user refreshes, they lose everything in the original code?
        // Let's implement the "Auto-Restore on Refresh" logic which is the goal of this task.

        const tryRestore = async () => {
            const restoredState: any = await loadState();
            if (restoredState && restoredState.messages && restoredState.messages.length > 0) {
                console.log('[ENGENIE_CHAT] Restoring previous interrupted session');
                setMessages(restoredState.messages);
                if (restoredState.sessionId) setSessionId(restoredState.sessionId);
                setIsHistory(true);
            } else {
                console.log('[ENGENIE_CHAT] No previous session found, starting fresh');
                setSessionId(`engenie_chat_${Date.now()}`);
                setMessages([]);
            }
        };
        tryRestore();

    }, [searchParams, clearState, loadState]); // Added clearState, loadState to deps

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
        await clearState();
        setMessages([]);
        setSessionId(`engenie_chat_${Date.now()}`);
        setHasAutoSubmitted(false);
        setIsHistory(false);
        toast({ title: "New Session", description: "Started fresh session" });
    };

    const handleSaveSession = () => {
        // Save current session
        const stateToSave = {
            messages: messages,
            sessionId: sessionId,
            savedAt: new Date().toISOString()
        };
        saveState();
        toast({ title: "Session Saved", description: "Your conversation has been saved" });
    };

    const handleExportChat = () => {
        // Export chat as text/markdown
        const chatText = messages.map(msg =>
            `[${msg.timestamp.toLocaleString()}] ${msg.type.toUpperCase()}: ${msg.content}`
        ).join('\n\n');

        const blob = new Blob([chatText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `engenie-chat-${sessionId}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        toast({ title: "Chat Exported", description: "Downloaded as text file" });
    };

    const handleLoadSessions = () => {
        // Navigate to sessions list or show modal
        toast({ title: "Load Sessions", description: "Feature coming soon!" });
    };

    const profileButtonLabel = user?.name || user?.username || "User";

    return (
        <div className="h-screen w-full app-glass-gradient flex flex-col overflow-hidden relative">
            <MainHeader
                rightContent={
                    <div className="flex items-center gap-2">
                        {/* Action Buttons */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSaveSession}
                            className="h-9 rounded-lg p-2 hover:bg-transparent transition-transform hover:scale-[1.2]"
                            title="Save Session"
                        >
                            <Save className="h-4 w-4" />
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportChat}
                            className="h-9 rounded-lg p-2 hover:bg-transparent transition-transform hover:scale-[1.2]"
                            title="Export Chat"
                            disabled={messages.length === 0}
                        >
                            <FileText className="h-4 w-4" />
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleLoadSessions}
                            className="h-9 rounded-lg p-2 hover:bg-transparent transition-transform hover:scale-[1.2]"
                            title="Load Sessions"
                        >
                            <FolderOpen className="h-4 w-4" />
                        </Button>

                        {/* New Session Button */}
                        <Button variant="outline" size="sm" onClick={handleNewSession}>
                            New Session
                        </Button>

                        {/* User Dropdown */}
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
            />

            {/* Chat Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 pt-24 space-y-4 custom-no-scrollbar pb-24">
                <div className="flex justify-center pb-6">
                    <h1 className="text-2xl font-bold text-[#0f172a] flex items-center gap-3">
                        Engenie <span className="text-primary text-2xl leading-none pt-1">♦</span> Chat
                    </h1>
                </div>

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
