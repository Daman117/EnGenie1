import { useRef, useState, useEffect, KeyboardEvent, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Database, Sparkles, AlertCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from 'react-markdown';
import BouncingDots from '@/components/AIRecommender/BouncingDots';
import { classifyRouteForProductInfo as classifyRoute, confirmRouteResponse, BASE_URL } from "@/components/AIRecommender/api";
import MainHeader from "@/components/MainHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

// UI Labels from backend
interface UILabels {
    loadingText: string;
    confirmationHint: string;
    inputPlaceholder: string;
    sourceDatabase: string;
    sourceLlm: string;
    sourcePending: string;
    errorMessage: string;
}

// MessageRow component with animations (same as Project.tsx - Solution page)
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

    const getSourceIcon = (source?: string) => {
        switch (source) {
            case "database":
                return <Database className="w-4 h-4 text-green-500" />;
            case "llm":
                return <Sparkles className="w-4 h-4 text-purple-500" />;
            case "pending_confirmation":
                return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            default:
                return null;
        }
    };

    const getSourceLabel = (source?: string) => {
        switch (source) {
            case "database":
                return uiLabels.sourceDatabase;
            case "llm":
                return uiLabels.sourceLlm;
            case "pending_confirmation":
                return uiLabels.sourcePending;
            default:
                return "";
        }
    };

    return (
        <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] flex items-start space-x-2 ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${message.type === 'user' ? 'bg-transparent text-white' : 'bg-transparent'}`}>
                    {message.type === 'user' ? (
                        <img src="/icon-user-3d.png" alt="User" className="w-10 h-10 object-contain" />
                    ) : (
                        <img src="/icon-engenie.png" alt="Assistant" className="w-14 h-14 object-contain" />
                    )}
                </div>

                {/* Message Bubble */}
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
                        {/* Message content with Markdown */}
                        <div>
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>

                        {/* Confirmation hint - from backend */}
                        {message.awaitingConfirmation && (
                            <div className="mt-2 pt-2 border-t border-yellow-200/50 text-xs text-yellow-700">
                                💡 {uiLabels.confirmationHint}
                            </div>
                        )}
                    </div>

                    {/* Timestamp */}
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

// Default UI labels (fallback)
const DEFAULT_UI_LABELS: UILabels = {
    loadingText: "Searching database...",
    confirmationHint: "Type 'Yes' for AI answer, or 'No' to skip",
    inputPlaceholder: "Ask about products, vendors, or specifications...",
    sourceDatabase: "From Database",
    sourceLlm: "From AI Knowledge",
    sourcePending: "Awaiting Your Response",
    errorMessage: "Sorry, something went wrong. Please try again."
};

// Escape string for use in RegExp
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Compute next available duplicate name
const computeNextDuplicateName = (base: string, projects: any[]) => {
    if (!base) return `${base} (1)`;
    const baseTrim = base.trim();

    const baseNameMatch = baseTrim.match(/^(.*?)(?:\s*\(\d+\))?$/);
    const actualBaseName = baseNameMatch ? baseNameMatch[1].trim() : baseTrim;

    const regex = new RegExp(`^${escapeRegExp(actualBaseName)}(?:\\s*\\((\\d+)\\))?$`, 'i');
    let maxNum = 0;
    let foundBase = false;

    for (const p of projects) {
        const pName = (p.projectName || p.project_name || '').trim();
        if (!pName) continue;
        const m = pName.match(regex);
        if (m) {
            if (!m[1]) {
                foundBase = true;
            } else {
                const n = parseInt(m[1], 10);
                if (!isNaN(n) && n > maxNum) maxNum = n;
            }
        }
    }

    if (maxNum > 0) {
        return `${actualBaseName} (${maxNum + 1})`;
    }

    if (foundBase) return `${actualBaseName} (1)`;

    return `${actualBaseName} (1)`;
};

// IndexedDB configuration for persisting Product Info state
const PRODUCT_INFO_DB_NAME = 'product_info_db';
const PRODUCT_INFO_STORE_NAME = 'product_info_state';
const PRODUCT_INFO_STATE_KEY = 'current_session';
const PRODUCT_INFO_BACKUP_KEY = 'product_info_state_backup';

// Helper function to open IndexedDB
const openProductInfoDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(PRODUCT_INFO_DB_NAME, 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(PRODUCT_INFO_STORE_NAME)) {
                db.createObjectStore(PRODUCT_INFO_STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

// Helper function to save state to IndexedDB
const saveStateToProductInfoDB = async (state: any): Promise<void> => {
    try {
        const db = await openProductInfoDB();
        const transaction = db.transaction(PRODUCT_INFO_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(PRODUCT_INFO_STORE_NAME);

        await new Promise<void>((resolve, reject) => {
            const request = store.put({ id: PRODUCT_INFO_STATE_KEY, ...state });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        db.close();
    } catch (e) {
        console.warn('[PRODUCT_INFO] Failed to save to IndexedDB:', e);
    }
};

// Helper function to load state from IndexedDB
const loadStateFromProductInfoDB = async (): Promise<any | null> => {
    try {
        const db = await openProductInfoDB();
        const transaction = db.transaction(PRODUCT_INFO_STORE_NAME, 'readonly');
        const store = transaction.objectStore(PRODUCT_INFO_STORE_NAME);

        const result = await new Promise<any>((resolve, reject) => {
            const request = store.get(PRODUCT_INFO_STATE_KEY);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        db.close();

        if (result) {
            // Restore Date objects for chat messages if needed
            if (result.messages) {
                result.messages = result.messages.map((msg: any) => ({
                    ...msg,
                    timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined
                }));
            }
            return result;
        }
        return null;
    } catch (e) {
        console.warn('[PRODUCT_INFO] Failed to load from IndexedDB:', e);
        return null;
    }
};

// Helper function to clear IndexedDB state
const clearProductInfoDBState = async (): Promise<void> => {
    try {
        const db = await openProductInfoDB();
        const transaction = db.transaction(PRODUCT_INFO_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(PRODUCT_INFO_STORE_NAME);

        await new Promise<void>((resolve, reject) => {
            const request = store.delete(PRODUCT_INFO_STATE_KEY);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        db.close();
        // Also clear localStorage backup
        localStorage.removeItem(PRODUCT_INFO_BACKUP_KEY);
        console.log('[PRODUCT_INFO] IndexedDB state cleared');
    } catch (e) {
        console.warn('[PRODUCT_INFO] Failed to clear IndexedDB:', e);
    }
};

const ProductInfo = () => {
    const { toast } = useToast();
    const { userSessionId } = useAuth(); // Get user session ID
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showThinking, setShowThinking] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [productInfoInstanceId, setproductInfoInstanceId] = useState(() => `product_info_${Date.now()}`);
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);
    const [isHistory, setIsHistory] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [uiLabels, setUiLabels] = useState<UILabels>(DEFAULT_UI_LABELS);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // State ref for immediate access during save  
    const stateRef = useRef({
        messages: [] as ChatMessage[],
        productInfoInstanceId: '',
        awaitingRouteConfirmation: false,
        pendingRouteTarget: '',
        pendingRouteQuery: '',
        pendingRouteMessages: { openingMessage: "", declineMessage: "", popupBlockedMessage: "" },
        inputValue: ''
    });



    // Track which page opened this one (to avoid opening duplicate windows when routing back)
    const [sourcePage] = useState<string | null>(() => {
        return sessionStorage.getItem('lastSourcePage') || null;
    });

    // Route confirmation states
    const [awaitingRouteConfirmation, setAwaitingRouteConfirmation] = useState(false);
    const [pendingRouteTarget, setPendingRouteTarget] = useState<string>("");
    const [pendingRouteQuery, setPendingRouteQuery] = useState<string>("");
    const [pendingRouteMessages, setPendingRouteMessages] = useState<{
        openingMessage: string;
        declineMessage: string;
        popupBlockedMessage: string;
    }>({ openingMessage: "", declineMessage: "", popupBlockedMessage: "" });

    // Keep stateRef in sync - Moved here to ensure all state vars are defined
    useEffect(() => {
        stateRef.current = {
            messages,
            productInfoInstanceId,
            awaitingRouteConfirmation,
            pendingRouteTarget,
            pendingRouteQuery,
            pendingRouteMessages,
            inputValue
        };
    }, [messages, productInfoInstanceId, awaitingRouteConfirmation, pendingRouteTarget, pendingRouteQuery, pendingRouteMessages, inputValue]);

    // Duplicate name dialog states
    const [duplicateNameDialogOpen, setDuplicateNameDialogOpen] = useState(false);
    const [duplicateProjectName, setDuplicateProjectName] = useState<string | null>(null);
    const [autoRenameSuggestion, setAutoRenameSuggestion] = useState<string | null>(null);
    const [duplicateDialogNameInput, setDuplicateDialogNameInput] = useState<string>('');
    const [duplicateDialogError, setDuplicateDialogError] = useState<string | null>(null);

    // Auto-scroll to bottom when new messages arrive - scroll within container only
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, showThinking]);

    // Convert snake_case to camelCase
    const toCamelCase = (obj: any): any => {
        if (Array.isArray(obj)) {
            return obj.map(v => toCamelCase(v));
        } else if (obj !== null && typeof obj === 'object') {
            return Object.keys(obj).reduce((acc: Record<string, any>, key: string) => {
                const camelKey = key.replace(/([-_][a-z])/g, (group) =>
                    group.toUpperCase().replace("-", "").replace("_", "")
                );
                acc[camelKey] = toCamelCase(obj[key]);
                return acc;
            }, {});
        }
        return obj;
    };

    // No init API call needed - use default labels for instant loading
    useEffect(() => {
        // Mark as initialized immediately - no slow API call needed
        setIsInitializing(false);
    }, []);

    // SAVE ON PAGE CLOSE/REFRESH: Save state immediately
    useEffect(() => {
        const handleBeforeUnload = () => {
            const stateToSave = {
                messages: stateRef.current.messages,
                productInfoInstanceId: stateRef.current.productInfoInstanceId,
                savedAt: new Date().toISOString()
            };

            // Use synchronous localStorage as fallback for immediate save
            try {
                localStorage.setItem(PRODUCT_INFO_BACKUP_KEY, JSON.stringify(stateToSave));
                console.log('[PRODUCT_INFO] Saved state to localStorage backup on page close');
            } catch (e) {
                console.warn('[PRODUCT_INFO] Failed to save backup state:', e);
            }

            // Also try to save to IndexedDB (might not complete)
            saveStateToProductInfoDB(stateToSave);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    // LOAD FROM INDEXEDDB: Restore state on mount (unless projectId is present)
    useEffect(() => {
        // If loading a specific project, don't restore session state
        if (searchParams.get('projectId')) return;

        const loadState = async () => {
            // Check if we need to clear state (triggered by New button)
            if (sessionStorage.getItem('clear_product_info_state') === 'true') {
                console.log('[PRODUCT_INFO] Clearing state as requested by New button');
                sessionStorage.removeItem('clear_product_info_state');
                await clearProductInfoDBState();
                return; // Don't restore anything
            }

            try {
                // First check localStorage backup (faster/synchronous)
                let restoredState: any = null;
                try {
                    const backup = localStorage.getItem(PRODUCT_INFO_BACKUP_KEY);
                    if (backup) {
                        restoredState = JSON.parse(backup);
                        console.log('[PRODUCT_INFO] Loaded state from localStorage backup');
                    }
                } catch (e) {
                    console.warn('[PRODUCT_INFO] Failed to load backup:', e);
                }

                // If no backup, try IndexedDB
                if (!restoredState) {
                    restoredState = await loadStateFromProductInfoDB();
                    if (restoredState) {
                        console.log('[PRODUCT_INFO] Loaded state from IndexedDB');
                    }
                }

                if (restoredState && restoredState.messages && restoredState.messages.length > 0) {
                    // Restore messages with proper Date objects
                    const restoredMessages = restoredState.messages.map((msg: any) => ({
                        ...msg,
                        timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined
                    }));

                    setMessages(restoredMessages);

                    // Restore the saved productInfoInstanceId to maintain backend conversation context
                    if (restoredState.productInfoInstanceId) {
                        console.log('[PRODUCT_INFO] Restoring productInfoInstanceId:', restoredState.productInfoInstanceId);
                        setproductInfoInstanceId(restoredState.productInfoInstanceId);
                    }

                    // Restore route confirmation state
                    if (restoredState.awaitingRouteConfirmation) {
                        setAwaitingRouteConfirmation(restoredState.awaitingRouteConfirmation);
                        setPendingRouteTarget(restoredState.pendingRouteTarget || '');
                        setPendingRouteQuery(restoredState.pendingRouteQuery || '');
                        setPendingRouteMessages(restoredState.pendingRouteMessages || { openingMessage: "", declineMessage: "", popupBlockedMessage: "" });
                    }

                    // Restore input value
                    if (restoredState.inputValue) {
                        setInputValue(restoredState.inputValue);
                    }

                    setHasAutoSubmitted(true); // Don't re-submit initial query
                    setIsHistory(true); // Disable animations

                    // Scroll to bottom
                    setTimeout(() => {
                        if (chatContainerRef.current) {
                            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                        }
                    }, 100);
                }
            } catch (e) {
                console.warn('[PRODUCT_INFO] Error restoring state:', e);
            }
        };

        loadState();
    }, [searchParams]);

    // Load project if projectId is in the URL
    useEffect(() => {
        const projectId = searchParams.get('projectId');
        if (!projectId) return;

        const loadProject = async () => {
            try {
                console.log('[PRODUCT_INFO] Loading project:', projectId);
                const response = await fetch(`${BASE_URL}/api/projects/${projectId}`, {
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Failed to load project');
                }

                const data = await response.json();
                const project = data.project || data;

                // Load conversation history from the project
                const convHistories = project.conversationHistories || project.conversation_histories || {};
                const productInfoHistory = convHistories['product-info'];

                if (productInfoHistory && productInfoHistory.messages) {
                    // Set messages from saved history
                    setMessages(productInfoHistory.messages);
                    setIsHistory(true); // Mark as history so animations don't play

                    // Restore productInfoInstanceId from top level or nested location
                    const restoredInstanceId = project.projectInstanceId || project.project_instance_id ||
                        productInfoHistory.productInfoInstanceId;
                    if (restoredInstanceId) {
                        console.log('[PRODUCT_INFO] Restoring productInfoInstanceId:', restoredInstanceId);
                        setproductInfoInstanceId(restoredInstanceId);
                    }

                    console.log('[PRODUCT_INFO] Loaded', productInfoHistory.messages.length, 'messages from project');

                    toast({
                        title: "Project Loaded",
                        description: `Loaded "${project.projectName || project.project_name}"`,
                    });
                }
            } catch (error: any) {
                console.error('[PRODUCT_INFO] Error loading project:', error);
                toast({
                    title: "Load Failed",
                    description: error.message || "Failed to load project",
                    variant: "destructive",
                });
            }
        };

        loadProject();
    }, [searchParams, toast]);

    // Set window name for BroadcastChannel targeting
    useEffect(() => {
        window.name = 'eng_product_info';
    }, []);

    // BroadcastChannel listener for receiving queries from other pages
    useEffect(() => {
        const channel = new BroadcastChannel('eng-route-handoff');

        const onMessage = (event: MessageEvent) => {
            const data: any = event.data;
            if (!data || typeof data !== 'object') return;
            if (data.type !== 'product_info_run_query') return;

            channel.postMessage({
                type: 'product_info_ack',
                requestId: data.requestId
            });

            // Focus this window to bring it to front
            window.focus();

            const incomingQuery = String(data.query || '').trim();
            if (!incomingQuery) return;

            // Submit the query directly
            setTimeout(() => {
                submitQuery(incomingQuery);
            }, 0);
        };

        channel.addEventListener('message', onMessage);
        return () => {
            channel.removeEventListener('message', onMessage);
            channel.close();
        };
    }, []);

    // Handle query from URL parameter (when redirected from Solution page)
    useEffect(() => {
        if (hasAutoSubmitted || isInitializing) return;

        const queryKey = searchParams.get('queryKey');
        if (queryKey) {
            const storedQuery = localStorage.getItem(queryKey);
            if (storedQuery) {
                console.log('[ProductInfo] Auto-submitting query from URL:', storedQuery);

                // Clean up localStorage
                localStorage.removeItem(queryKey);

                // Auto-submit the query immediately (don't show in input box)
                setHasAutoSubmitted(true);
                submitQuery(storedQuery);
            }
        }
    }, [searchParams, hasAutoSubmitted, isInitializing]);

    const queryProductInfo = async (query: string): Promise<RAGResponse> => {
        try {
            const response = await axios.post("/api/product-info/query", {
                query,
                session_id: productInfoInstanceId,
                user_session_id: userSessionId // Pass user session ID
            }, {
                withCredentials: true
            });
            return toCamelCase(response.data) as RAGResponse;
        } catch (error: any) {
            console.error("RAG query error:", error);
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

    // Separate function to submit query (used by both handleSend and auto-submit)
    const submitQuery = async (query: string) => {
        // Add user message
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
            // =====================================================
            // STEP 1: Check if user is responding to route confirmation
            // =====================================================
            if (awaitingRouteConfirmation) {
                console.log('[ROUTE] User responding to route confirmation, calling LLM...');

                // Use LLM to classify yes/no/unclear
                const confirmResult = await confirmRouteResponse(
                    query,
                    "product_info",
                    pendingRouteTarget,
                    pendingRouteQuery,
                    productInfoInstanceId,
                    userSessionId
                );

                console.log('[ROUTE] Confirmation result:', confirmResult);

                if (confirmResult.action === 'confirm' && confirmResult.proceedWithRouting) {
                    console.log(`[ROUTE] User confirmed - opening ${pendingRouteTarget}`);

                    setShowThinking(false);

                    // Check if we're routing back to the source page (Solution)
                    // In this case, send the query via BroadcastChannel to be processed
                    const normalizedTarget = pendingRouteTarget === 'solution' ? 'solution' : pendingRouteTarget;
                    if (sourcePage && (sourcePage === normalizedTarget || sourcePage === 'solution' && normalizedTarget === 'solution')) {
                        // Routing back to Solution page - send query via BroadcastChannel
                        console.log('[ROUTE] Routing back to source page (Solution) with query');

                        const requestId = `solution_back_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                        const channel = new BroadcastChannel('eng-route-handoff');

                        const ackPromise = new Promise<boolean>((resolve) => {
                            const timeout = window.setTimeout(() => {
                                channel.removeEventListener('message', onMessage);
                                resolve(false);
                            }, 150);

                            const onMessage = (event: MessageEvent) => {
                                const data: any = event.data;
                                if (data && data.type === 'solution_ack' && data.requestId === requestId) {
                                    window.clearTimeout(timeout);
                                    channel.removeEventListener('message', onMessage);
                                    resolve(true);
                                }
                            };

                            channel.addEventListener('message', onMessage);
                        });

                        // Send the query to Solution page
                        channel.postMessage({
                            type: 'solution_run_query',
                            requestId,
                            query: pendingRouteQuery
                        });

                        const acked = await ackPromise;
                        channel.close();

                        if (acked) {
                            // Solution page received the query - show message and focus
                            const switchMessage: ChatMessage = {
                                id: `assistant_switch_${Date.now()}`,
                                type: "assistant",
                                content: pendingRouteMessages.openingMessage || confirmResult.message,
                                timestamp: new Date()
                            };
                            setMessages(prev => [...prev, switchMessage]);

                            // Focus the Solution window with smooth transition
                            setTimeout(() => {
                                const solutionWindow = window.open('', 'eng_solution');
                                try {
                                    solutionWindow?.focus();
                                } catch { }
                            }, 100);

                            toast({
                                title: "Query Sent",
                                description: "Your query has been sent to the Solution page.",
                            });

                            // Clear route confirmation state
                            setAwaitingRouteConfirmation(false);
                            setPendingRouteTarget("");
                            setPendingRouteQuery("");
                            setPendingRouteMessages({ openingMessage: "", declineMessage: "", popupBlockedMessage: "" });
                            setIsLoading(false);
                            return;
                        }

                        // If BroadcastChannel failed, fall through to the regular approach below
                        console.log('[ROUTE] BroadcastChannel failed, falling through to regular approach');
                    }

                    // If Solution page is already open, send the query there instead of opening a duplicate tab
                    if (pendingRouteTarget === 'solution') {
                        const preFocusWindow = window.open('', 'eng_solution');
                        try {
                            preFocusWindow?.focus();
                        } catch { }

                        const requestId = `solution_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                        const channel = new BroadcastChannel('eng-route-handoff');

                        const ackPromise = new Promise<boolean>((resolve) => {
                            const timeout = window.setTimeout(() => {
                                channel.removeEventListener('message', onMessage);
                                resolve(false);
                            }, 150);

                            const onMessage = (event: MessageEvent) => {
                                const data: any = event.data;
                                if (data && data.type === 'solution_ack' && data.requestId === requestId) {
                                    window.clearTimeout(timeout);
                                    channel.removeEventListener('message', onMessage);
                                    resolve(true);
                                }
                            };

                            channel.addEventListener('message', onMessage);
                        });

                        channel.postMessage({
                            type: 'solution_run_query',
                            requestId,
                            query: pendingRouteQuery
                        });

                        const acked = await ackPromise;
                        channel.close();

                        if (acked) {
                            // Focus the Solution window with smooth transition
                            setTimeout(() => {
                                const solutionWindow = window.open('', 'eng_solution');
                                try {
                                    solutionWindow?.focus();
                                } catch { }
                            }, 100);

                            const confirmMessage: ChatMessage = {
                                id: `assistant_${Date.now()}`,
                                type: "assistant",
                                content: pendingRouteMessages.openingMessage || confirmResult.message,
                                timestamp: new Date()
                            };
                            setMessages(prev => [...prev, confirmMessage]);

                            setAwaitingRouteConfirmation(false);
                            setPendingRouteTarget("");
                            setPendingRouteQuery("");
                            setPendingRouteMessages({ openingMessage: "", declineMessage: "", popupBlockedMessage: "" });
                            setIsLoading(false);
                            return;
                        }
                    }

                    // If search page is already open, send the query there instead of opening a duplicate tab
                    if (pendingRouteTarget === 'search') {
                        const preFocusWindow = window.open('', 'eng_search');
                        try {
                            preFocusWindow?.focus();
                        } catch { }

                        const requestId = `search_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                        const channel = new BroadcastChannel('eng-route-handoff');

                        const ackPromise = new Promise<boolean>((resolve) => {
                            const timeout = window.setTimeout(() => {
                                channel.removeEventListener('message', onMessage);
                                resolve(false);
                            }, 150);

                            const onMessage = (event: MessageEvent) => {
                                const data: any = event.data;
                                if (data && data.type === 'search_ack' && data.requestId === requestId) {
                                    window.clearTimeout(timeout);
                                    channel.removeEventListener('message', onMessage);
                                    resolve(true);
                                }
                            };

                            channel.addEventListener('message', onMessage);
                        });

                        channel.postMessage({
                            type: 'search_run_query',
                            requestId,
                            query: pendingRouteQuery
                        });

                        const acked = await ackPromise;
                        channel.close();

                        if (acked) {
                            // Focus the search window with smooth transition
                            setTimeout(() => {
                                const searchWindow = window.open('', 'eng_search');
                                try {
                                    searchWindow?.focus();
                                } catch { }
                            }, 100);

                            const confirmMessage: ChatMessage = {
                                id: `assistant_${Date.now()}`,
                                type: "assistant",
                                content: pendingRouteMessages.openingMessage || confirmResult.message,
                                timestamp: new Date()
                            };
                            setMessages(prev => [...prev, confirmMessage]);

                            setAwaitingRouteConfirmation(false);
                            setPendingRouteTarget("");
                            setPendingRouteQuery("");
                            setPendingRouteMessages({ openingMessage: "", declineMessage: "", popupBlockedMessage: "" });
                            setIsLoading(false);
                            return;
                        }
                    }

                    // NOT going back to source - show opening message and open new window
                    const confirmMessage: ChatMessage = {
                        id: `assistant_${Date.now()}`,
                        type: "assistant",
                        content: pendingRouteMessages.openingMessage || confirmResult.message,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, confirmMessage]);

                    // Store query for target page
                    const queryKey = `route_query_${Date.now()}`;
                    localStorage.setItem(queryKey, pendingRouteQuery);

                    // Build URL based on target page
                    let targetUrl = '';
                    if (pendingRouteTarget === 'solution') {
                        targetUrl = `/solution?queryKey=${queryKey}`;
                    } else if (pendingRouteTarget === 'search') {
                        targetUrl = `/search?dataKey=${queryKey}`;
                    }

                    // Open in new window with appropriate window name
                    const windowName = pendingRouteTarget === 'solution' ? 'eng_solution'
                        : pendingRouteTarget === 'search' ? 'eng_search'
                            : '_blank';
                    const newWindow = window.open(targetUrl, windowName);
                    const isPopupBlocked = !newWindow || newWindow.closed || typeof newWindow.closed === 'undefined';
                    if (isPopupBlocked) {
                        const linkMessage: ChatMessage = {
                            id: `assistant_link_${Date.now()}`,
                            type: "assistant",
                            content: `${pendingRouteMessages.popupBlockedMessage || ""}\n\n[Open page](${targetUrl})`.trim(),
                            timestamp: new Date()
                        };
                        setMessages(prev => [...prev, linkMessage]);
                        toast({
                            title: "Popup Blocked",
                            description: "Please allow popups or click the link.",
                            variant: "destructive",
                        });
                    } else {
                        // Focus new window with smooth transition
                        setTimeout(() => {
                            try {
                                newWindow?.focus();
                            } catch { }
                        }, 100);
                        toast({
                            title: "Opening New Tab",
                            description: "A new tab has been opened",
                        });
                    }

                    // Clear route confirmation state
                    setAwaitingRouteConfirmation(false);
                    setPendingRouteTarget("");
                    setPendingRouteQuery("");
                    setPendingRouteMessages({ openingMessage: "", declineMessage: "", popupBlockedMessage: "" });
                    setIsLoading(false);
                    return;
                }

                if (confirmResult.action === 'decline') {
                    console.log('[ROUTE] User declined - staying on Product Info');

                    setShowThinking(false);

                    // Use LLM-generated decline message
                    const declineMessageContent: ChatMessage = {
                        id: `assistant_${Date.now()}`,
                        type: "assistant",
                        content: confirmResult.message,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, declineMessageContent]);

                    // Clear route confirmation state
                    setAwaitingRouteConfirmation(false);
                    setPendingRouteTarget("");
                    setPendingRouteQuery("");
                    setPendingRouteMessages({ openingMessage: "", declineMessage: "", popupBlockedMessage: "" });
                    setIsLoading(false);
                    return;
                }

                // Unclear response - clear state and treat as new input
                console.log('[ROUTE] Unclear response - treating as new input');
                setAwaitingRouteConfirmation(false);
                setPendingRouteTarget("");
                setPendingRouteQuery("");
                setPendingRouteMessages({ openingMessage: "", declineMessage: "", popupBlockedMessage: "" });
            }

            // =====================================================
            // STEP 2: Check route classification for new queries
            // =====================================================
            const routeResult = await classifyRoute(query, "product_info", productInfoInstanceId, userSessionId);
            console.log('[ROUTE] Classification result:', routeResult);

            // CASE 1: Direct response (greeting, chitchat, general question, etc.)
            if (routeResult.directResponse) {
                setShowThinking(false);

                // Add assistant message
                const assistantMessage: ChatMessage = {
                    id: `assistant_${Date.now()}`,
                    type: "assistant", // Use "assistant" here
                    content: routeResult.directResponse,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, assistantMessage]);
                setIsLoading(false);
                return;
            }

            // CASE 2: Routing to a different page is needed
            if (routeResult.requiresConfirmation && routeResult.targetPage !== 'product_info') {
                console.log(`[ROUTE] Routing to ${routeResult.targetPage} requires confirmation`);

                setShowThinking(false);

                // Show confirmation message
                const routeMessage: ChatMessage = {
                    id: `assistant_route_${Date.now()}`,
                    type: "assistant",
                    content: routeResult.confirmationMessage,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, routeMessage]);

                // Set confirmation state with all LLM-generated messages
                setAwaitingRouteConfirmation(true);
                setPendingRouteTarget(routeResult.targetPage);
                setPendingRouteQuery(routeResult.originalQuery);
                setPendingRouteMessages({
                    openingMessage: routeResult.openingMessage,
                    declineMessage: routeResult.declineMessage,
                    popupBlockedMessage: routeResult.popupBlockedMessage
                });
                setIsLoading(false);
                return;
            }

            // =====================================================
            // STEP 3: Continue with normal Product Info query
            // =====================================================
            const response = await queryProductInfo(query);

            // Hide thinking indicator
            setShowThinking(false);

            // Add assistant message
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

            // Show toast for source
            if (response.source === "database") {
                toast({
                    title: uiLabels.sourceDatabase,
                    description: `${response.sourcesUsed?.join(", ") || "database"}`,
                });
            } else if (response.source === "llm") {
                toast({
                    title: uiLabels.sourceLlm,
                    description: "AI knowledge",
                });
            }
        } catch (error) {
            console.error("Error querying product info:", error);
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

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = async () => {
        const trimmedInput = inputValue.trim();
        if (!trimmedInput) {
            return;
        }

        // Reset textarea height to initial height before sending
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

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

    // Helper to extract first N words from input
    const extractFirstWords = (input: string, count: number = 2): string => {
        if (!input || typeof input !== 'string') return 'Product Info';

        // Clean and split the input
        const words = input.trim().split(/\s+/).filter(word => word.length > 0);

        if (words.length === 0) return 'Product Info';

        // Take first N words and capitalize first letter of each
        const firstWords = words.slice(0, count).map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');

        return firstWords || 'Product Info';
    };

    // Reset duplicate dialog state
    const resetDuplicateDialog = () => {
        setDuplicateNameDialogOpen(false);
        setDuplicateProjectName(null);
        setAutoRenameSuggestion(null);
        setDuplicateDialogError(null);
        setDuplicateDialogNameInput('');
    };

    // Save project functionality with duplicate name handling
    const handleSaveProject = async (
        overrideName?: string,
        options?: { skipDuplicateDialog?: boolean }
    ) => {
        if (messages.length === 0) {
            toast({
                title: "Nothing to Save",
                description: "Start a conversation first before saving.",
                variant: "destructive",
            });
            return;
        }

        try {
            // Extract first 2 words from the first user message for project name
            let projectNameBase = 'Product Info';
            const firstUserMessage = messages.find(m => m.type === 'user');
            if (firstUserMessage && firstUserMessage.content) {
                projectNameBase = extractFirstWords(firstUserMessage.content, 2);
            }

            // Use override name if provided, otherwise add "(Product Info)" suffix
            // Determine base name from override or project context
            let baseName = overrideName ? overrideName.trim() : projectNameBase;

            // Strip existing screen suffixes to avoid accumulation or wrong context
            baseName = baseName.replace(/\s*\((Search|Solution|Product Info)\)$/i, '').trim();

            // Enforce (Product Info) suffix for projects saved from this screen
            const effectiveProjectName = `${baseName} (Product Info)`;

            // Check for duplicate project name
            if (!options?.skipDuplicateDialog) {
                try {
                    const listResponse = await fetch(`${BASE_URL}/api/projects`, {
                        credentials: 'include'
                    });

                    if (listResponse.ok) {
                        const data = await listResponse.json();
                        const projects: any[] = data.projects || [];

                        const nameLower = effectiveProjectName.toLowerCase();
                        const hasDuplicate = projects.some((p: any) => {
                            const pName = (p.projectName || p.project_name || '').trim();
                            if (!pName) return false;
                            return pName.toLowerCase() === nameLower;
                        });

                        if (hasDuplicate) {
                            const suggested = computeNextDuplicateName(effectiveProjectName, projects);
                            setDuplicateProjectName(effectiveProjectName);
                            setAutoRenameSuggestion(suggested);
                            setDuplicateDialogNameInput(effectiveProjectName);
                            setDuplicateNameDialogOpen(true);
                            return;
                        }
                    }
                } catch (e) {
                    // If duplicate check fails, continue with normal save flow.
                }
            }

            // Get the first user message as initial requirements
            const firstUserMsg = messages.find(m => m.type === 'user');
            const initialRequirements = firstUserMsg?.content || 'Product information inquiry';

            const projectData = {
                project_name: effectiveProjectName,
                project_description: `Product Info conversation - Created on ${new Date().toLocaleDateString()}`,
                initial_requirements: initialRequirements,
                source_page: 'product-info',
                project_instance_id: productInfoInstanceId, // Save the product info instance ID at top level
                conversation_histories: {
                    'product-info': {
                        messages: messages,
                        productInfoInstanceId: productInfoInstanceId,
                    }
                },
                product_type: 'product-info',
                current_step: 'conversation',
                workflow_position: {
                    current_tab: 'product-info',
                    has_results: messages.length > 0,
                    last_interaction: new Date().toISOString(),
                    project_phase: 'product_inquiry'
                },
                user_interactions: {
                    conversations_count: 1,
                    messages_count: messages.length,
                    last_save: new Date().toISOString()
                }
            };

            console.log('[PRODUCT_INFO_SAVE] Saving project:', effectiveProjectName);

            const response = await fetch(`${BASE_URL}/api/projects/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(projectData),
            });

            if (!response.ok) {
                let errorData: any = null;
                try {
                    errorData = await response.json();
                } catch (e) {
                    // ignore JSON parse errors
                }

                const errorMessage = errorData?.error || 'Failed to save project';
                const errorCode = errorData?.code || errorData?.errorCode;

                const looksLikeDuplicateNameError =
                    response.status === 409 ||
                    errorCode === 'DUPLICATE_PROJECT_NAME' ||
                    /already exists|already present|duplicate project name/i.test(errorMessage);

                if (!options?.skipDuplicateDialog && looksLikeDuplicateNameError) {
                    const nameInErrorMatch = errorMessage.match(/"([^"]+)"/);
                    const nameFromError = nameInErrorMatch ? nameInErrorMatch[1] : effectiveProjectName;

                    let suggested = `${nameFromError} (1)`;
                    try {
                        const listResp = await fetch(`${BASE_URL}/api/projects`, { credentials: 'include' });
                        if (listResp.ok) {
                            const listData = await listResp.json();
                            suggested = computeNextDuplicateName(nameFromError, listData.projects || []);
                        }
                    } catch (e) {
                        // fallback remains
                    }

                    setDuplicateProjectName(nameFromError);
                    setAutoRenameSuggestion(suggested);
                    setDuplicateDialogNameInput(nameFromError);
                    setDuplicateDialogError(null);
                    setDuplicateNameDialogOpen(true);
                    return;
                }

                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('[PRODUCT_INFO_SAVE] Project saved successfully:', result);

            toast({
                title: "Project Saved",
                description: `"${effectiveProjectName}" has been saved successfully.`,
            });

        } catch (error: any) {
            console.error('[PRODUCT_INFO_SAVE] Error saving project:', error);
            toast({
                title: "Save Failed",
                description: error.message || "Failed to save project",
                variant: "destructive",
            });
        }
    };

    // Handle duplicate name dialog actions
    const handleDuplicateNameChangeConfirm = () => {
        const trimmed = (duplicateDialogNameInput || '').trim();
        if (!trimmed) {
            setDuplicateDialogError('Project name is required');
            return;
        }

        resetDuplicateDialog();
        handleSaveProject(trimmed, { skipDuplicateDialog: false });
    };

    const handleDuplicateNameAutoRename = async () => {
        const baseName = (duplicateProjectName || '').trim() || 'Product Info';
        let suggested = autoRenameSuggestion || `${baseName} (1)`;
        try {
            const listResp = await fetch(`${BASE_URL}/api/projects`, { credentials: 'include' });
            if (listResp.ok) {
                const listData = await listResp.json();
                suggested = computeNextDuplicateName(baseName, listData.projects || []);
            }
        } catch (e) {
            // ignore and use fallback
        }

        resetDuplicateDialog();
        handleSaveProject(suggested, { skipDuplicateDialog: true });
    };

    // Show loading state while initializing
    if (isInitializing) {
        return (
            <div className="flex flex-col h-screen text-foreground app-glass-gradient items-center justify-center">
                <div className="flex items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full app-glass-gradient flex flex-col overflow-hidden relative">

            {/* MAIN HEADER - Fixed at top with animated video logo and profile */}
            <MainHeader onSave={() => handleSaveProject()} />

            {/* SECOND HEADER - Below main header, not scrollable */}
            <div className="flex-none pt-24 pb-0">
                <div className="py-0 border-b border-white/10 bg-transparent flex justify-center items-center">
                    <div className="flex items-center gap-1">
                        <div className="flex items-center justify-center">
                            <img
                                src="/icon-engenie.png"
                                alt="EnGenie"
                                className="w-16 h-16 object-contain"
                            />
                        </div>
                        <h1 className="text-3xl font-bold text-[#0f172a] inline-flex items-center gap-2 whitespace-nowrap">
                            EnGenie <span>* Product Info</span>
                        </h1>
                    </div>
                </div>
            </div>

            {/* Chat Messages Area - Scrolls behind the input */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-no-scrollbar pb-24">
                {messages.map((message) => (
                    <MessageRow
                        key={message.id}
                        message={message}
                        isHistory={isHistory}
                        uiLabels={uiLabels}
                    />
                ))}

                {/* Bouncing Dots Loading Indicator */}
                {showThinking && (
                    <div className="flex justify-start">
                        <div className="max-w-[80%] flex items-start space-x-2">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-transparent">
                                <img src="/icon-engenie.png" alt="Assistant" className="w-14 h-14 object-contain" />
                            </div>
                            <div className="p-3 rounded-lg">
                                <BouncingDots />
                                <span className="sr-only">{uiLabels.loadingText}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Form - Fixed at viewport bottom, messages scroll behind it */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-transparent z-30 pointer-events-none">
                <div className="max-w-4xl mx-auto px-2 md:px-8 pointer-events-auto">
                    <form onSubmit={handleSubmit}>
                        <div className="relative group">
                            <div
                                className={`relative w-full rounded-[26px] transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-transparent hover:scale-[1.02]`}
                                style={{
                                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                                    WebkitBackdropFilter: 'blur(12px)',
                                    backdropFilter: 'blur(12px)',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid rgba(255, 255, 255, 0.4)',
                                    color: 'rgba(0, 0, 0, 0.8)'
                                }}
                            >
                                <textarea
                                    ref={textareaRef}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    onInput={(e) => {
                                        const target = e.target as HTMLTextAreaElement;
                                        target.style.height = 'auto';
                                        target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
                                    }}
                                    className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none px-4 py-2.5 pr-20 text-sm resize-none min-h-[40px] max-h-[150px] leading-relaxed flex items-center custom-no-scrollbar"
                                    style={{
                                        fontSize: '16px',
                                        fontFamily: 'inherit',
                                        boxShadow: 'none',
                                        overflowY: 'auto'
                                    }}
                                    placeholder="Ask about products, vendors, or specifications..."
                                    disabled={isLoading}
                                />

                                {/* Action Button */}
                                <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5">
                                    <Button
                                        type="submit"
                                        disabled={!inputValue.trim() || isLoading}
                                        className={`w-8 h-8 p-0 rounded-full transition-all duration-300 flex-shrink-0 hover:bg-transparent ${!inputValue.trim() ? 'text-muted-foreground' : 'text-primary hover:scale-110'}`}
                                        variant="ghost"
                                        size="icon"
                                        title="Submit"
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

            {/* Duplicate project name dialog */}
            <AlertDialog
                open={duplicateNameDialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        resetDuplicateDialog();
                    } else {
                        setDuplicateNameDialogOpen(open);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Project name already exists</AlertDialogTitle>
                        <AlertDialogDescription>
                            {duplicateProjectName
                                ? `"${duplicateProjectName}" is already present. Do you want to change the project name, or save it as "${(autoRenameSuggestion || `${duplicateProjectName} (1)`)}"?`
                                : 'A project with this name is already present. Do you want to change the project name, or save it with a default suffix (1)?'}
                        </AlertDialogDescription>
                        <div className="mt-4 space-y-2">
                            <label htmlFor="duplicate-project-name-input-pi" className="text-sm font-medium">
                                New project name
                            </label>
                            <input
                                id="duplicate-project-name-input-pi"
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                value={duplicateDialogNameInput}
                                onChange={(e) => {
                                    setDuplicateDialogNameInput(e.target.value);
                                    if (duplicateDialogError) {
                                        setDuplicateDialogError(null);
                                    }
                                }}
                                autoFocus
                            />
                            {duplicateDialogError && (
                                <p className="text-xs text-destructive">{duplicateDialogError}</p>
                            )}
                        </div>
                    </AlertDialogHeader>
                    <button
                        type="button"
                        onClick={resetDuplicateDialog}
                        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                        aria-label="Close duplicate name dialog"
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={handleDuplicateNameAutoRename}>
                            Use suggested name
                        </AlertDialogAction>
                        <AlertDialogAction onClick={handleDuplicateNameChangeConfirm}>
                            Save new name
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
};

export default ProductInfo;
