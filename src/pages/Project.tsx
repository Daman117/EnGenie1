import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Play, Bot, LogOut, User, Upload, Save, FolderOpen, FileText, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { BASE_URL } from '../components/AIRecommender/api';
import { routeUserInputByIntent, validateRequirements } from '@/components/AIRecommender/api';

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from 'react-markdown';
import BouncingDots from '@/components/AIRecommender/BouncingDots';

import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import AIRecommender from "@/components/AIRecommender";
import { useAuth } from '@/contexts/AuthContext';
import ProjectListDialog from '@/components/ProjectListDialog';
import '../components/TabsLayout.css';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ProfileEditDialog } from '@/components/ProfileEditDialog';
import { MainHeader } from '@/components/MainHeader';

interface IdentifiedInstrument {
    category: string;
    quantity?: number;
    productName: string;
    specifications: Record<string, string>;
    sampleInput: string;
    item_thread_id?: string;
    workflow_thread_id?: string;
    main_thread_id?: string;
}

interface IdentifiedAccessory {
    category: string;
    quantity?: number;
    accessoryName: string;
    specifications: Record<string, string>;
    sampleInput: string;
    item_thread_id?: string;
    workflow_thread_id?: string;
    main_thread_id?: string;
}

// Action button interface for chat messages
interface ChatActionButton {
    label: string;
    action: 'openNewWindow' | 'navigate' | 'custom';
    url?: string;
    icon?: string;
}

// Chat message interface for Project page
interface ProjectChatMessage {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    actionButtons?: ChatActionButton[];  // Optional action buttons
}

// MessageRow component with animations (same as Dashboard)
interface MessageRowProps {
    message: ProjectChatMessage;
    isHistory: boolean;
}

const MessageRow = ({ message, isHistory }: MessageRowProps) => {
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

    // Handler for action buttons
    const handleActionClick = (action: ChatActionButton) => {
        if (action.action === 'openNewWindow' && action.url) {
            // Open in a new tab in the same browser window (not a popup)
            window.open(action.url, '_blank');
        } else if (action.action === 'navigate' && action.url) {
            window.location.href = action.url;
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

                        {/* Render action buttons if present */}
                        {message.actionButtons && message.actionButtons.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {message.actionButtons.map((btn, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleActionClick(btn)}
                                        className="px-4 py-2.5 rounded-lg font-semibold text-white text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95 flex items-center gap-2"
                                        style={{
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                                        }}
                                    >
                                        {btn.icon && <span>{btn.icon}</span>}
                                        {btn.label}
                                    </button>
                                ))}
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

const Project = () => {
    const [requirements, setRequirements] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [instruments, setInstruments] = useState<IdentifiedInstrument[]>([]);
    const [accessories, setAccessories] = useState<IdentifiedAccessory[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('project');
    const [previousTab, setPreviousTab] = useState<string>('project');
    const [searchTabs, setSearchTabs] = useState<{ id: string; title: string; input: string; isDirectSearch?: boolean; productType?: string; itemThreadId?: string; workflowThreadId?: string; mainThreadId?: string }[]>([]);
    const [projectName, setProjectName] = useState<string>('Project');
    const [editingProjectName, setEditingProjectName] = useState<boolean>(false);
    const [editProjectNameValue, setEditProjectNameValue] = useState<string>(projectName);
    const editNameInputRef = useRef<HTMLInputElement | null>(null);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [duplicateNameDialogOpen, setDuplicateNameDialogOpen] = useState(false);
    const [duplicateProjectName, setDuplicateProjectName] = useState<string | null>(null);
    const [autoRenameSuggestion, setAutoRenameSuggestion] = useState<string | null>(null);
    const [duplicateDialogNameInput, setDuplicateDialogNameInput] = useState<string>('');
    const [duplicateDialogError, setDuplicateDialogError] = useState<string | null>(null);
    const [isProjectListOpen, setIsProjectListOpen] = useState(false);
    const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);

    // Right panel dock state
    const [isRightDocked, setIsRightDocked] = useState(true);

    // NEW: Field descriptions for tooltips
    const [fieldDescriptions, setFieldDescriptions] = useState<Record<string, string>>({});

    // Track conversation states for each search tab
    const [tabStates, setTabStates] = useState<Record<string, any>>({});
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user, logout } = useAuth(); // Get user info and logout function

    // NEW: For scroll position handling
    const projectScrollRef = useRef<HTMLDivElement | null>(null);
    const [savedScrollPosition, setSavedScrollPosition] = useState(0);

    // NEW: For generic product type images
    const [genericImages, setGenericImages] = useState<Record<string, string>>({});

    // NEW: Chat messages for Project page (replaces responseMessage)
    const [chatMessages, setChatMessages] = useState<ProjectChatMessage[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isHistoryRef = useRef(true);
    const [showThinking, setShowThinking] = useState(false);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, showThinking]);

    // Set isHistory to false after initial mount so new messages animate
    useEffect(() => {
        const timer = setTimeout(() => {
            isHistoryRef.current = false;
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    // Show thinking indicator with delay
    useEffect(() => {
        if (isLoading) {
            const timer = setTimeout(() => setShowThinking(true), 600);
            return () => clearTimeout(timer);
        } else {
            setShowThinking(false);
        }
    }, [isLoading]);

    // Helper to add a message to chat (with optional action buttons)
    const addChatMessage = (type: 'user' | 'assistant', content: string, actionButtons?: ChatActionButton[]) => {
        const newMessage: ProjectChatMessage = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            type,
            content,
            timestamp: new Date(),
            actionButtons
        };
        setChatMessages(prev => [...prev, newMessage]);
    };

    // NEW: For file upload
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [extractedText, setExtractedText] = useState<string>('');
    const [isExtracting, setIsExtracting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // =================================================================================================
    // PERSISTENCE LOGIC (IndexedDB + LocalStorage)
    // =================================================================================================

    const PROJECT_DB_NAME = 'project_page_db';
    const PROJECT_STORE_NAME = 'project_state';
    const PROJECT_STATE_KEY = 'current_project_session';
    const PROJECT_BACKUP_KEY = 'project_page_state_backup';

    const openProjectDB = (): Promise<IDBDatabase> => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(PROJECT_DB_NAME, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(PROJECT_STORE_NAME)) {
                    db.createObjectStore(PROJECT_STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    };

    const saveStateToProjectDB = async (state: any): Promise<void> => {
        try {
            const db = await openProjectDB();
            const transaction = db.transaction(PROJECT_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(PROJECT_STORE_NAME);
            await new Promise<void>((resolve, reject) => {
                const request = store.put({ id: PROJECT_STATE_KEY, ...state });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            db.close();

            // Backup to local storage (lighter version if needed, or full if fits)
            // We use a try-catch for localStorage incase of quota exceeded
            try {
                // Only save essential metadata to localStorage to avoid quota limits
                const backupState = {
                    projectName: state.projectName,
                    currentProjectId: state.currentProjectId,
                    timestamp: new Date().toISOString()
                };
                localStorage.setItem(PROJECT_BACKUP_KEY, JSON.stringify(backupState));
            } catch (e) {
                console.warn('[PERSISTENCE] LocalStorage backup failed:', e);
            }
        } catch (e) {
            console.warn('[PERSISTENCE] Failed to save to IndexedDB:', e);
        }
    };

    const loadStateFromProjectDB = async (): Promise<any | null> => {
        try {
            const db = await openProjectDB();
            const transaction = db.transaction(PROJECT_STORE_NAME, 'readonly');
            const store = transaction.objectStore(PROJECT_STORE_NAME);
            const result = await new Promise<any>((resolve, reject) => {
                const request = store.get(PROJECT_STATE_KEY);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            db.close();

            // Fix date objects restoration
            if (result) {
                if (result.chatMessages) {
                    result.chatMessages = result.chatMessages.map((msg: any) => ({
                        ...msg,
                        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
                    }));
                }
            }
            return result || null;
        } catch (e) {
            console.warn('[PERSISTENCE] Failed to load from IndexedDB:', e);
            return null;
        }
    };

    // State ref to access latest state in event listeners (like beforeunload)
    const stateRef = useRef({
        requirements: '',
        instruments: [] as IdentifiedInstrument[],
        accessories: [] as IdentifiedAccessory[],
        showResults: false,
        activeTab: 'project',
        searchTabs: [] as any[],
        projectName: 'Project',
        currentProjectId: null as string | null,
        chatMessages: [] as ProjectChatMessage[],
        isRightDocked: true,
        genericImages: {} as Record<string, string>,
        tabStates: {} as Record<string, any>,
        savedScrollPosition: 0,
        fieldDescriptions: {} as Record<string, string>
    });

    // Update stateRef whenever relevant state changes
    useEffect(() => {
        stateRef.current = {
            requirements,
            instruments,
            accessories,
            showResults,
            activeTab,
            searchTabs,
            projectName,
            currentProjectId,
            chatMessages,
            isRightDocked,
            genericImages,
            tabStates,
            savedScrollPosition: projectScrollRef.current ? projectScrollRef.current.scrollTop : 0,
            fieldDescriptions
        };
    }, [
        requirements, instruments, accessories, showResults, activeTab,
        searchTabs, projectName, currentProjectId, chatMessages,
        isRightDocked, genericImages, tabStates, fieldDescriptions
    ]);

    // Load state on mount
    useEffect(() => {
        /* 
        DISABLED: User requested that previously stored session should NOT open automatically.
        Session should only be restored via explicit user interaction (e.g. Open Project button).
        
        const loadState = async () => {
            const savedState = await loadStateFromProjectDB();
            if (savedState) {
                console.log('[PERSISTENCE] Restoring state from IndexedDB...');

                // Restore state
                if (savedState.requirements) setRequirements(savedState.requirements);
                if (savedState.instruments) setInstruments(savedState.instruments);
                if (savedState.accessories) setAccessories(savedState.accessories);
                if (savedState.showResults) setShowResults(savedState.showResults);
                if (savedState.activeTab) setActiveTab(savedState.activeTab);
                if (savedState.searchTabs) setSearchTabs(savedState.searchTabs);
                if (savedState.projectName) setProjectName(savedState.projectName);
                if (savedState.currentProjectId) setCurrentProjectId(savedState.currentProjectId);
                if (savedState.chatMessages) {
                    setChatMessages(savedState.chatMessages);
                    // Disable history animation for restored messages
                    isHistoryRef.current = true;
                }
                if (savedState.isRightDocked !== undefined) setIsRightDocked(savedState.isRightDocked);
                if (savedState.genericImages) setGenericImages(savedState.genericImages);
                if (savedState.tabStates) setTabStates(savedState.tabStates);
                if (savedState.fieldDescriptions) setFieldDescriptions(savedState.fieldDescriptions);

                // Restore scroll position
                if (savedState.savedScrollPosition) {
                    setSavedScrollPosition(savedState.savedScrollPosition);
                    // Attempt to restore immediately and also after render
                    setTimeout(() => {
                        if (projectScrollRef.current) {
                            projectScrollRef.current.scrollTop = savedState.savedScrollPosition;
                        }
                    }, 100);
                }

                toast({
                    title: "Session Restored",
                    description: "Your previous session has been restored.",
                    duration: 3000
                });
            }
        };

        loadState(); 
        */
    }, []); // Run once on mount

    // Save state on unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            // Capture current scroll position one last time
            const scrollTop = projectScrollRef.current ? projectScrollRef.current.scrollTop : 0;

            const stateToSave = {
                ...stateRef.current,
                savedScrollPosition: scrollTop,
                savedAt: new Date().toISOString()
            };

            saveStateToProjectDB(stateToSave);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        // Also save periodically (every 30 seconds) to prevent data loss on crash
        const autoSaveInterval = setInterval(() => {
            // Capture current scroll position
            const scrollTop = projectScrollRef.current ? projectScrollRef.current.scrollTop : 0;

            const stateToSave = {
                ...stateRef.current,
                savedScrollPosition: scrollTop,
                savedAt: new Date().toISOString()
            };
            saveStateToProjectDB(stateToSave);
        }, 30000);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            clearInterval(autoSaveInterval);
            // Save on unmount as well
            handleBeforeUnload();
        };
    }, []);

    // Track scroll position changes for the active tab (debounced)
    const handleScroll = () => {
        if (projectScrollRef.current && activeTab === 'project') {
            // We don't need to do anything complex here as we read from ref on save
            // But we could update state if needed for other features
        }
    };

    const capitalizeFirstLetter = (str?: string): string => {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    // Helper to convert relative image URLs to absolute URLs
    const getAbsoluteImageUrl = (url: string | undefined | null): string | undefined => {
        if (!url) return undefined;

        // Already absolute URL
        if (url.startsWith('http') || url.startsWith('data:')) {
            return url;
        }

        // Convert relative URL to absolute
        const baseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
        const path = url.startsWith('/') ? url : `/${url}`;
        return `${baseUrl}${path}`;
    };

    // Helper to format keys: snake_case/space separated -> Title_Case_With_Underscores
    const prettifyKey = (key: string) => {
        // Handle undefined or empty keys
        if (!key) return "";

        // 1. Split by underscores, spaces, or camelCase boundaries
        // 2. Filter empty parts
        // 3. Capitalize first letter of each part
        // 4. Join with underscores
        return key
            .replace(/([A-Z])/g, ' $1') // Split camelCase
            .replace(/_/g, ' ')         // Normalize underscores to spaces first
            .trim()
            .split(/\s+/)               // Split by whitespace
            .map(part => part.charAt(0).toUpperCase() + part.slice(1)) // Capitalize
            .join('_');                 // Join with underscores
    };

    // SEQUENTIAL image loading - prevents rate limit issues with LLM generation
    // Cached images load instantly (no delay), only uncached ones are slow
    const fetchGenericImagesLazy = async (productTypes: string[]) => {
        const uniqueTypes = [...new Set(productTypes)]; // Remove duplicates

        console.log(`[SEQUENTIAL_LOAD] Starting sequential load for ${uniqueTypes.length} images...`);

        // Load images one by one - cached ones are instant, uncached trigger LLM
        for (let i = 0; i < uniqueTypes.length; i++) {
            const productType = uniqueTypes[i];

            // Skip if already loaded
            if (genericImages[productType]) {
                console.log(`[SEQUENTIAL_LOAD] [${i + 1}/${uniqueTypes.length}] Already loaded: ${productType}`);
                continue;
            }

            try {
                const encodedType = encodeURIComponent(productType);
                console.log(`[SEQUENTIAL_LOAD] [${i + 1}/${uniqueTypes.length}] Fetching: ${productType}`);

                const response = await fetch(`${BASE_URL}/api/generic_image/${encodedType}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.image) {
                        const absoluteUrl = getAbsoluteImageUrl(data.image.url);
                        if (absoluteUrl) {
                            // Update state immediately for each image (shows as soon as loaded)
                            setGenericImages(prev => ({
                                ...prev,
                                [productType]: absoluteUrl
                            }));
                            console.log(`[SEQUENTIAL_LOAD] ✓ Loaded ${i + 1}/${uniqueTypes.length}: ${productType}`);
                        }
                    }
                } else if (response.status === 404) {
                    // Image not found - likely LLM generation failed due to rate limit
                    console.warn(`[SEQUENTIAL_LOAD] ✗ Not found: ${productType} (may need LLM generation later)`);
                } else {
                    console.warn(`[SEQUENTIAL_LOAD] ✗ Failed (${response.status}): ${productType}`);
                }
            } catch (error) {
                console.error(`[SEQUENTIAL_LOAD] ✗ Error fetching ${productType}:`, error);
            }
        }

        console.log(`[SEQUENTIAL_LOAD] All ${uniqueTypes.length} images processed.`);
    };

    // Escape string for use in RegExp
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Compute next available duplicate name: e.g., if 'Name' exists, suggest 'Name (1)';
    // if 'Name (1)' exists, suggest 'Name (2)', etc.
    const computeNextDuplicateName = (base: string, projects: any[]) => {
        if (!base) return `${base} (1)`;
        const baseTrim = base.trim();

        // Extract the actual base name without any numbering
        // If base is "Distillation Column (1)", extract "Distillation Column"
        const baseNameMatch = baseTrim.match(/^(.*?)(?:\s*\(\d+\))?$/);
        const actualBaseName = baseNameMatch ? baseNameMatch[1].trim() : baseTrim;

        // Create regex to match all variations of the base name with numbers
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

        // fallback
        return `${actualBaseName} (1)`;
    };

    useEffect(() => {
        setEditProjectNameValue(projectName);
    }, [projectName]);

    const profileButtonLabel = capitalizeFirstLetter(user?.name || user?.username || "User");
    const profileFullName = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username || "User";

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        // Check if we have either text requirements or extracted text from file
        if (!requirements.trim() && !extractedText.trim()) {
            toast({
                title: "Input Required",
                description: "Please enter your requirements or attach a file",
                variant: "destructive",
            });
            return;
        }

        // Combine manual requirements with extracted text from file
        const finalRequirements = requirements.trim() && extractedText.trim()
            ? `${requirements}\n\n${extractedText}`
            : requirements.trim() || extractedText.trim();

        // Create display message for chat (show file name instead of extracted text)
        const displayMessage = attachedFile
            ? requirements.trim()
                ? `${requirements.trim()}\n\n📎 ${attachedFile.name}`
                : `📎 ${attachedFile.name}`
            : requirements.trim();

        // Add user message to chat (show file name, not extracted text)
        addChatMessage('user', displayMessage);

        // Clear the input immediately after adding the message
        setRequirements('');

        // Clear attached file immediately after capturing the display message
        setAttachedFile(null);
        setExtractedText('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        setIsLoading(true);

        try {
            // ====================================================================
            // UNIFIED INTENT ROUTING - Routes based on intent classification
            // NO direct workflow calls - intent classification determines the route
            // ====================================================================
            console.log('[INTENT_ROUTER] Routing user input with', instruments.length, 'instruments and', accessories.length, 'accessories');

            // Use unified intent-based routing instead of direct workflow calls
            const response = await routeUserInputByIntent(
                finalRequirements,
                instruments.length > 0 ? instruments : undefined,
                accessories.length > 0 ? accessories : undefined
            );

            // Check response type and intent
            const responseType = response.responseType;
            const isSolution = response.isSolution;

            console.log('[INTENT_ROUTER] Response:', { intent: response.intent, responseType, isSolution });

            // CASE 1: Greeting response - Show message in chat
            if (responseType === 'greeting') {
                addChatMessage('assistant', response.message || "Hello! How can I help you find industrial instruments today?");
                setShowResults(true);
                // Keep existing data on greeting
                if (instruments.length === 0 && accessories.length === 0) {
                    setInstruments([]);
                    setAccessories([]);
                }
                return;
            }

            // CASE 2: Question response - Show message in chat
            if (responseType === 'question') {
                addChatMessage('assistant', response.message || '');
                setShowResults(true);
                // Keep existing data on question
                if (instruments.length === 0 && accessories.length === 0) {
                    setInstruments([]);
                    setAccessories([]);
                }
                return;
            }

            // CASE 2.5: Workflow Suggestion - Show clickable option to open EnGenie Chat in new window
            if (responseType === 'workflowSuggestion') {
                if (response.suggestWorkflow?.workflow_id === 'engenie_chat') {
                    console.log('[PROJECT] User asked a general question -> EnGenie Chat');
                }
                const queryEncoded = encodeURIComponent(finalRequirements);
                const enGenieChatUrl = `${window.location.origin}/chat?query=${queryEncoded}`;

                // Show message with action button that opens in new window
                addChatMessage(
                    'assistant',
                    response.message || 'This looks like a knowledge question. Click the button below to get detailed answers from our knowledge base.',
                    [
                        {
                            label: '🚀 Open Chat',
                            action: 'openNewWindow',
                            url: enGenieChatUrl,
                            icon: '💬'
                        }
                    ]
                );

                setShowResults(true);
                return;
            }

            // CASE 3: Modification response - Update the list with changes
            if (responseType === 'modification') {
                const modMessage = response.message || 'I\'ve updated your instrument list based on your request.';
                addChatMessage('assistant', modMessage);

                // Update instruments and accessories with modified list
                setInstruments(response.instruments || []);
                setAccessories(response.accessories || []);
                setShowResults(true);

                // Lazy load generic images for any new items
                const productNames: string[] = [];
                (response.instruments || []).forEach((inst: any) => {
                    if (inst.productName) productNames.push(inst.productName);
                });
                (response.accessories || []).forEach((acc: any) => {
                    if (acc.accessoryName) productNames.push(acc.accessoryName);
                });

                // Only fetch images for items not already loaded
                const newProductNames = productNames.filter(name => !genericImages[name]);
                if (newProductNames.length > 0) {
                    fetchGenericImagesLazy(newProductNames);
                }

                const changeCount = response.changesMade?.length || 0;
                toast({
                    title: "List Updated",
                    description: `Applied ${changeCount} change(s). You now have ${response.instruments?.length || 0} instruments and ${response.accessories?.length || 0} accessories.`,
                });
                return;
            }

            // CASE 4: Solution response (complex engineering challenge)
            // Also handles regular requirements response
            if (responseType === 'solution' || responseType === 'requirements') {
                // Log solution-specific handling
                if (isSolution) {
                    console.log('[SOLUTION] Processing solution workflow response');
                }

                setInstruments(response.instruments || []);
                setAccessories(response.accessories || []);
                setShowResults(true);

                // Automatically undock the right panel when results arrive
                setIsRightDocked(false);

                // Set the project name from the API response
                if (response.projectName) {
                    setProjectName(response.projectName);
                }

                // Capture field descriptions if available
                if (response.fieldDescriptions || response.field_descriptions) {
                    const loadedDescriptions = response.fieldDescriptions || response.field_descriptions;
                    console.log('Loaded field descriptions from solution response:', Object.keys(loadedDescriptions).length);
                    setFieldDescriptions(loadedDescriptions);
                }

                // Lazy load generic images in BACKGROUND (non-blocking)
                const productNames: string[] = [];
                (response.instruments || []).forEach((inst: any) => {
                    if (inst.productName) productNames.push(inst.productName);
                });
                (response.accessories || []).forEach((acc: any) => {
                    if (acc.accessoryName) productNames.push(acc.accessoryName);
                });

                if (productNames.length > 0) {
                    fetchGenericImagesLazy(productNames);
                }

                // Solution-specific toast message
                const toastTitle = isSolution ? "Solution Identified" : "Success";
                const toastDesc = isSolution
                    ? `Identified ${response.instruments?.length || 0} instruments and ${response.accessories?.length || 0} accessories for your engineering challenge`
                    : `Identified ${response.instruments?.length || 0} instruments and ${response.accessories?.length || 0} accessories`;

                toast({
                    title: toastTitle,
                    description: toastDesc,
                });
            }

        } catch (error: any) {
            addChatMessage('assistant', `I couldn't process your request. ${error.message || 'Please try again.'}`);
            toast({
                title: "Error",
                description: error.message || "Failed to process request",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Handle file selection and immediately extract text
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Attach the file and start extraction immediately
        setAttachedFile(file);
        setIsExtracting(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${BASE_URL}/api/upload-requirements`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to extract text from file');
            }

            const data = await response.json();

            if (data.success && data.extracted_text) {
                // Store the extracted text for later use on submit
                setExtractedText(data.extracted_text);

            } else {
                throw new Error(data.error || 'No text extracted from file');
            }
        } catch (error: any) {
            toast({
                title: "Extraction Failed",
                description: error.message || "Failed to extract text from file",
                variant: "destructive",
            });
            // Clear the file if extraction failed
            setAttachedFile(null);
            setExtractedText('');
        } finally {
            setIsExtracting(false);
            // Reset file input so the same file can be selected again if needed
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Handle removing attached file and its extracted text
    const handleRemoveFile = () => {
        setAttachedFile(null);
        setExtractedText('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const addSearchTab = (
        input: string,
        categoryName?: string,
        isDirectSearch: boolean = false,
        productType?: string,
        itemThreadId?: string,
        workflowThreadId?: string,
        mainThreadId?: string
    ) => {
        // Save current scroll position before switching tabs
        if (activeTab === 'project' && projectScrollRef.current) {
            setSavedScrollPosition(projectScrollRef.current.scrollTop);
        }

        const title = categoryName || `Search ${searchTabs.length + 1}`;
        const existingTabIndex = searchTabs.findIndex(tab => tab.title === title);

        if (existingTabIndex !== -1) {
            const updatedTabs = [...searchTabs];
            // Update existing tab with new input and direct search flag
            updatedTabs[existingTabIndex] = {
                ...updatedTabs[existingTabIndex],
                input,
                isDirectSearch,
                productType,
                itemThreadId,
                workflowThreadId,
                mainThreadId
            };
            setSearchTabs(updatedTabs);

            setTimeout(() => {
                setPreviousTab(activeTab);
                setActiveTab(updatedTabs[existingTabIndex].id);
            }, 0);

            return;
        }

        const nextIndex = searchTabs.length + 1;
        const id = `search-${Date.now()}-${nextIndex}`;
        const newTabs = [
            ...searchTabs,
            {
                id,
                title,
                input,
                isDirectSearch,
                productType,
                itemThreadId,
                workflowThreadId,
                mainThreadId
            }
        ];
        setSearchTabs(newTabs);

        setTimeout(() => {
            setPreviousTab(activeTab);
            setActiveTab(id);
        }, 0);
    };

    const closeSearchTab = (id: string) => {
        const remaining = searchTabs.filter(t => t.id !== id);
        setSearchTabs(remaining);
        if (activeTab === id) {
            const targetTab = remaining.find(t => t.id === previousTab)
                ? previousTab
                : remaining.length > 0
                    ? remaining[remaining.length - 1].id
                    : 'project';

            // If returning to project tab, restore scroll position
            setPreviousTab(activeTab);
            setActiveTab(targetTab);
        }
    };

    const handleRun = async (instrument: IdentifiedInstrument, index: number) => {
        const qty = instrument.quantity ? ` (${instrument.quantity})` : '';

        // Pass instrument.category as productType for proper schema lookup
        // Pass thread IDs received from backend for workflow resumption
        addSearchTab(
            instrument.sampleInput,
            `${index + 1}. ${instrument.category}${qty}`,
            true,
            instrument.category,
            instrument.item_thread_id,
            instrument.workflow_thread_id,
            instrument.main_thread_id
        );
    };

    const handleRunAccessory = async (accessory: IdentifiedAccessory, index: number) => {
        const qty = accessory.quantity ? ` (${accessory.quantity})` : '';

        // Smart category extraction: If category is generic "Accessories", extract the type from accessoryName
        let smartCategory = accessory.category || '';
        const accessoryName = accessory.accessoryName || '';
        const isGeneric = smartCategory.toLowerCase() === 'accessories' || smartCategory.toLowerCase() === 'accessory';

        if (isGeneric && accessoryName) {
            // Extract product type from accessoryName (before " for ")
            // e.g., "Thermowell for Process Temperature Transmitter" -> "Thermowell"
            const parts = accessoryName.split(' for ');
            smartCategory = parts[0] || accessoryName;
        }

        // Pass smart category for both tab title and productType for schema lookup
        // Pass thread IDs received from backend for workflow resumption
        addSearchTab(
            accessory.sampleInput,
            `${index + 1}. ${smartCategory}${qty}`,
            true,
            smartCategory,
            accessory.item_thread_id,
            accessory.workflow_thread_id,
            accessory.main_thread_id
        );
    };

    const handleNewProject = () => {
        // Clear current project ID to create a new project instead of updating
        setCurrentProjectId(null);

        // Reset all project state
        setShowResults(false);
        setInstruments([]);
        setAccessories([]);
        setRequirements('');
        setChatMessages([]); // Clear chat messages
        setSearchTabs([]);
        setPreviousTab('project');
        setActiveTab('project');
        setProjectName('Project'); // Reset project name to default
        setTabStates({});

        console.log('Started new project - cleared project ID');

        toast({
            title: "New Project Started",
            description: "You can now create a fresh project",
        });
    };

    // Handle state updates from AIRecommender instances
    const handleTabStateChange = (tabId: string, state: any) => {
        setTabStates(prev => {
            // Only update if state has actually changed
            if (JSON.stringify(prev[tabId]) !== JSON.stringify(state)) {
                return {
                    ...prev,
                    [tabId]: state
                };
            }
            return prev;
        });
    };

    const handleSaveProject = async (
        overrideName?: string,
        options?: { skipDuplicateDialog?: boolean }
    ) => {
        // Use detected product type if available; do NOT fallback to projectName.
        // Do not call validation during Save to avoid blocking the save operation.
        let detectedProductType = tabStates['project']?.currentProductType;

        // Fallback: Try to detect product type from identified instruments or accessories if not in tab state
        if (!detectedProductType && instruments.length > 0) {
            detectedProductType = instruments[0].category || instruments[0].productName;
        }
        if (!detectedProductType && accessories.length > 0) {
            detectedProductType = accessories[0].category || accessories[0].accessoryName;
        }
        detectedProductType = detectedProductType || '';

        // Smart Name Generation: If project name is generic "Project", try to use the detected product type
        let nameToUse = overrideName || projectName;
        if ((!nameToUse || nameToUse.trim() === 'Project') && detectedProductType) {
            nameToUse = capitalizeFirstLetter(detectedProductType);
        }

        const effectiveProjectName = (nameToUse || '').trim() || 'Project';

        try {
            // Collect all current project data including chat states
            const conversationHistories: Record<string, any> = {};
            const collectedDataAll: Record<string, any> = {};
            const analysisResults: Record<string, any> = {};

            // Collect data from each search tab
            const allFieldDescriptions: Record<string, string> = {};
            Object.entries(tabStates).forEach(([tabId, state]) => {
                if (state) {
                    conversationHistories[tabId] = {
                        messages: state.messages || [],
                        currentStep: state.currentStep || 'greeting',
                        searchSessionId: state.searchSessionId,
                        // Extended state for complete restoration
                        requirementSchema: state.requirementSchema || null,
                        validationResult: state.validationResult || null,
                        currentProductType: state.currentProductType || null,
                        inputValue: state.inputValue || '',
                        advancedParameters: state.advancedParameters || null,
                        selectedAdvancedParams: state.selectedAdvancedParams || {},
                        fieldDescriptions: state.fieldDescriptions || {}
                    };

                    if (state.collectedData) {
                        collectedDataAll[tabId] = state.collectedData;
                    }

                    if (state.analysisResult) {
                        analysisResults[tabId] = state.analysisResult;
                    }

                    // Merge field descriptions from all tabs
                    if (state.fieldDescriptions) {
                        Object.assign(allFieldDescriptions, state.fieldDescriptions);
                    }
                }
            });

            // Create field descriptions for better data understanding
            const baseFieldDescriptions = {
                project_name: 'Name/title of the project',
                project_description: 'Detailed description of the project purpose and scope',
                initial_requirements: 'Original user requirements and specifications provided at project start',
                product_type: 'Type/category of product being developed or analyzed',
                identified_instruments: 'List of instruments identified as suitable for the project requirements',
                identified_accessories: 'List of accessories and supporting equipment identified for the project',
                search_tabs: 'Individual search sessions created by user for different aspects of the project',
                conversation_histories: 'Complete conversation threads for each search tab including AI interactions',
                collected_data: 'Data collected during conversations and analysis for each search tab',
                current_step: 'Current workflow step in the project (greeting, requirements, analysis, etc.)',
                active_tab: 'The tab that was active when the project was last saved',
                analysis_results: 'Results from AI analysis and recommendations for each search tab',
                workflow_position: 'Detailed position in workflow to enable exact continuation',
                user_interactions: 'Summary of user actions and decisions made during the project',
                project_metadata: 'Additional metadata about project creation, updates, and usage patterns'
            };

            // Merge field descriptions from tabs with base descriptions
            const fieldDescriptions = { ...baseFieldDescriptions, ...allFieldDescriptions };

            // Check for duplicate project name on the client by looking at existing projects.
            // This ensures we can prompt even if the backend does not enforce unique names.
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
                            const pId = p.id || p._id || null;
                            if (!pName) return false;
                            // Same name (case-insensitive) and not the very same project we are updating
                            const isSameName = pName.toLowerCase() === nameLower;
                            const isSameProject = currentProjectId && pId === currentProjectId;
                            return isSameName && !isSameProject;
                        });

                        if (hasDuplicate) {
                            const projectsList: any[] = data.projects || [];
                            const suggested = computeNextDuplicateName(effectiveProjectName, projectsList);
                            setDuplicateProjectName(effectiveProjectName);
                            setAutoRenameSuggestion(suggested);
                            setDuplicateNameDialogOpen(true);
                            return;
                        }
                    }
                } catch (e) {
                    // If duplicate check fails, continue with normal save flow.
                }
            }

            // Combine manual requirements with extracted text from file (same logic as submit)
            const finalRequirements = requirements.trim() && extractedText.trim()
                ? `${requirements}\n\n${extractedText}`
                : requirements.trim() || extractedText.trim();

            const projectData: any = {
                project_name: effectiveProjectName,
                project_description: `Project for ${effectiveProjectName} - Created on ${new Date().toLocaleDateString()}`,
                initial_requirements: finalRequirements,
                product_type: detectedProductType,
                detected_product_type: detectedProductType,
                identified_instruments: instruments,
                identified_accessories: accessories,
                search_tabs: searchTabs,
                conversation_histories: conversationHistories,
                collected_data: collectedDataAll,
                generic_images: genericImages,
                project_chat_messages: chatMessages, // Save Project page chat messages
                current_step: activeTab === 'project' ? (showResults ? 'showSummary' : 'initialInput') : 'search',
                active_tab: activeTab === 'project' ? 'Project' : (searchTabs.find(t => t.id === activeTab)?.title || activeTab), // Save tab name instead of ID
                analysis_results: analysisResults,
                field_descriptions: fieldDescriptions,
                workflow_position: {
                    current_tab: activeTab,
                    has_results: showResults,
                    total_search_tabs: searchTabs.length,
                    last_interaction: new Date().toISOString(),
                    project_phase: showResults ? 'results_review' : 'requirements_gathering'
                },
                user_interactions: {
                    tabs_created: searchTabs.length,
                    conversations_count: Object.keys(conversationHistories).length,
                    has_analysis: Object.keys(analysisResults).length > 0,
                    last_save: new Date().toISOString()
                }
            };

            // Include client-side pricing and feedback entries if present in local state
            // `pricing` may be assembled by the frontend or analysisResult; include if available
            if ((analysisResults && Object.keys(analysisResults).length > 0) || (tabStates && Object.keys(tabStates).length > 0)) {
                try {
                    // Try to collect pricing info from tab states (from RightPanel)
                    const pricingDataFromTabs: any = {};
                    Object.entries(tabStates).forEach(([tabId, tabState]: [string, any]) => {
                        if (tabState && tabState.pricingData && Object.keys(tabState.pricingData).length > 0) {
                            console.log(`[SAVE_PROJECT] Collecting pricing data from tab ${tabId}:`, Object.keys(tabState.pricingData).length, 'products');
                            pricingDataFromTabs[tabId] = tabState.pricingData;
                        }
                    });

                    if (Object.keys(pricingDataFromTabs).length > 0) {
                        projectData.pricing = pricingDataFromTabs;
                        console.log(`[SAVE_PROJECT] Included pricing data from`, Object.keys(pricingDataFromTabs).length, 'tabs');
                    }

                    // Also try to collect pricing info embedded in analysisResults for the active tab (fallback)
                    const activeAnalysis = analysisResults[activeTab] || analysisResults['project'] || null;
                    if (activeAnalysis && activeAnalysis.pricing && !projectData.pricing) {
                        projectData.pricing = activeAnalysis.pricing;
                    }
                } catch (e) {
                    console.error('[SAVE_PROJECT] Error collecting pricing data:', e);
                }
            }

            // If UI has any feedback objects (from RightPanel interactions), include them
            // We expect feedback entries to be stored in `tabStates` under each tab's user interactions
            try {
                const feedbackEntries: any[] = [];
                Object.values(tabStates).forEach((s: any) => {
                    if (s && s.feedbackEntries && Array.isArray(s.feedbackEntrieshy)) {
                        feedbackEntries.push(...s.feedbackEntries);
                    }
                });
                if (feedbackEntries.length > 0) projectData.feedback_entries = feedbackEntries;
            } catch (e) {
                // ignore
            }

            // If we have a current project ID, include it to update the existing project
            if (currentProjectId) {
                projectData.project_id = currentProjectId;
                console.log('Updating existing project:', currentProjectId);
            } else {
                console.log('Creating new project');
            }
            console.log('Saving project with comprehensive data and descriptions:', {
                fieldCount: Object.keys(projectData).length,
                hasFieldDescriptions: !!projectData.field_descriptions,
                descriptionsCount: projectData.field_descriptions ? Object.keys(projectData.field_descriptions).length : 0,
                hasWorkflowPosition: !!projectData.workflow_position,
                hasUserInteractions: !!projectData.user_interactions
            });

            const response = await fetch(`${BASE_URL}/api/projects/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Include only media currently displayed on the frontend (reduce unnecessary downloads/storage)
                body: JSON.stringify({
                    ...projectData,
                    displayed_media_map: (() => {
                        try {
                            const map: Record<string, any> = {};
                            const activeState = tabStates[activeTab];
                            if (!activeState || !activeState.analysisResult) return map;

                            const ranked = (activeState.analysisResult?.overallRanking?.rankedProducts) || [];
                            ranked.forEach((product: any) => {
                                try {
                                    // Save ALL products (both exact and approximate matches)
                                    if (!product) return;
                                    const vendor = product.vendor || product.vendorName || product.vendor_name || '';
                                    const pname = product.productName || product.product_name || product.name || '';
                                    if (!vendor && !pname) return;
                                    const key = `${vendor}-${pname}`.trim();
                                    const entry: any = {};

                                    const top = product.topImage || product.top_image || product.top_image_url || product.topImageUrl || null;
                                    const vendorLogo = product.vendorLogo || product.vendor_logo || product.logo || null;

                                    const resolveUrl = (obj: any) => {
                                        if (!obj) return null;
                                        if (typeof obj === 'string') return obj;
                                        return obj.url || obj.src || null;
                                    };

                                    const topUrl = resolveUrl(top);
                                    const vLogoUrl = resolveUrl(vendorLogo);

                                    if (topUrl) entry.top_image = { url: topUrl };
                                    if (vLogoUrl) entry.vendor_logo = { url: vLogoUrl };

                                    // Add matchType metadata
                                    entry.matchType = product.requirementsMatch ? 'exact' : 'approximate';

                                    if (Object.keys(entry).length > 0) map[key] = entry;
                                } catch (e) {
                                    // Continue on minor errors
                                }
                            });
                            return map;
                        } catch (e) {
                            return {};
                        }
                    })()
                }),
                credentials: 'include'
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
                    // Compute smarter suggestion based on existing projects
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

                    // Do not show generic error toast here; the dialog will guide the user.
                    return;
                }

                throw new Error(errorMessage);
            }

            const result = await response.json();

            // Extract project_id from the response
            // Backend returns: { message: "...", project: { project_id: "...", ... } }
            const savedProjectId = result.project?.project_id || result.project_id;

            // If we didn't have a project ID before, set it now for future updates
            if (!currentProjectId && savedProjectId) {
                setCurrentProjectId(savedProjectId);
                console.log('Set currentProjectId for future updates:', savedProjectId);
            }

            // Ensure local state reflects the name we actually saved
            if (overrideName && overrideName.trim()) {
                setProjectName(overrideName.trim());
            }

            toast({
                title: currentProjectId ? "Project Updated" : "Project Saved",
                description: currentProjectId
                    ? `"${effectiveProjectName}" has been updated successfully`
                    : `"${effectiveProjectName}" has been saved successfully`,
            });

        } catch (error: any) {
            // Check if this is a duplicate name error from backend
            const errorMessage = error.message || "";
            if (errorMessage.includes("already exists") && errorMessage.includes("Please choose a different name")) {
                // Extract the project name from the error message
                const nameMatch = errorMessage.match(/Project name '([^']+)' already exists/);
                const duplicateName = nameMatch ? nameMatch[1] : effectiveProjectName;

                // Get current projects to compute suggestion
                try {
                    const listResp = await fetch(`${BASE_URL}/api/projects`, { credentials: 'include' });
                    if (listResp.ok) {
                        const listData = await listResp.json();
                        const suggested = computeNextDuplicateName(duplicateName, listData.projects || []);
                        setDuplicateProjectName(duplicateName);
                        setAutoRenameSuggestion(suggested);
                        setDuplicateDialogNameInput(duplicateName);
                        setDuplicateDialogError(null);
                        setDuplicateNameDialogOpen(true);
                        return; // Don't show the generic error toast
                    }
                } catch (e) {
                    // If we can't get projects list, fall back to default behavior
                }
            }

            toast({
                title: "Save Failed",
                description: error.message || "Failed to save project",
                variant: "destructive",
            });
        }
    };

    const handleProjectDelete = (deletedProjectId: string) => {
        // Check if the deleted project was the currently active one
        if (currentProjectId === deletedProjectId) {
            console.log('Current project was deleted, starting new project...');
            handleNewProject();
        }
    };

    const handleOpenProject = async (projectId: string) => {
        try {
            const response = await fetch(`${BASE_URL}/api/projects/${projectId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load project');
            }

            const data = await response.json();
            const project = data.project;
            console.log('Loading project data:', project);

            // Do not clear existing session state before loading project

            // Restore project state with debugging
            // Restore product type from loaded project
            const restoredProductType = project.productType || project.product_type || projectName;
            setProjectName(project.projectName || project.project_name || 'Project');
            setRequirements(project.initialRequirements || project.initial_requirements || '');
            setInstruments(project.identifiedInstruments || project.identified_instruments || []);
            setAccessories(project.identifiedAccessories || project.identified_accessories || []);
            // Set product type in tabStates for use in API calls
            setTabStates(prev => ({
                ...prev,
                project: {
                    ...(prev.project || {}),
                    currentProductType: restoredProductType
                }
            }));
            console.log('Restoring project name:', project.projectName || project.project_name);
            setProjectName(project.projectName || project.project_name || 'Project');

            console.log('Restoring requirements:', (project.initialRequirements || project.initial_requirements || '').substring(0, 100));
            setRequirements(project.initialRequirements || project.initial_requirements || '');

            console.log('Restoring instruments count:', (project.identifiedInstruments || project.identified_instruments || []).length);
            setInstruments(project.identifiedInstruments || project.identified_instruments || []);

            console.log('Restoring accessories count:', (project.identifiedAccessories || project.identified_accessories || []).length);
            console.log('Restoring accessories count:', (project.identifiedAccessories || project.identified_accessories || []).length);
            setAccessories(project.identifiedAccessories || project.identified_accessories || []);

            // Restore generic images
            const savedGenericImages = project.genericImages || project.generic_images || {};
            if (Object.keys(savedGenericImages).length > 0) {
                console.log('Restoring generic images:', Object.keys(savedGenericImages).length);
                // Convert all relative URLs to absolute URLs for deployment compatibility
                const absoluteGenericImages: Record<string, string> = {};
                Object.entries(savedGenericImages).forEach(([key, url]) => {
                    const absoluteUrl = getAbsoluteImageUrl(url as string);
                    if (absoluteUrl) {
                        absoluteGenericImages[key] = absoluteUrl;
                    }
                });
                setGenericImages(absoluteGenericImages);
            } else {
                setGenericImages({});
            }

            // Restore Project page chat messages
            const savedChatMessages = project.projectChatMessages || project.project_chat_messages || [];
            if (savedChatMessages.length > 0) {
                console.log('Restoring Project page chat messages:', savedChatMessages.length);
                // Convert timestamp strings back to Date objects
                const restoredMessages = savedChatMessages.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                }));
                setChatMessages(restoredMessages);
                // Mark as history so messages don't animate on load
                isHistoryRef.current = true;

                // Allow new messages to animate after load
                setTimeout(() => {
                    isHistoryRef.current = false;
                }, 1000);
            } else {
                setChatMessages([]);
            }

            // Show results if we have instruments/accessories
            const instruments = project.identifiedInstruments || project.identified_instruments || [];
            const accessories = project.identifiedAccessories || project.identified_accessories || [];
            console.log('Checking results - instruments:', instruments.length, 'accessories:', accessories.length);
            const hasResults = instruments.length > 0 || accessories.length > 0;
            if (hasResults) {
                console.log('Setting showResults to true');
                setShowResults(true);
            } else {
                console.log('No results to show, keeping showResults false');
            }

            // Restore search tabs and conversation states
            const savedSearchTabs = project.searchTabs || project.search_tabs || [];
            console.log('Saved search tabs:', savedSearchTabs);

            if (savedSearchTabs.length > 0) {
                console.log('Restoring search tabs...');
                setSearchTabs(savedSearchTabs);

                // Restore conversation histories for each tab
                const conversationHistories = project.conversationHistories || project.conversation_histories || project.conversationHistory || project.conversation_history || {};
                const restoredTabStates: Record<string, any> = {};

                console.log('Conversation histories:', conversationHistories);

                savedSearchTabs.forEach((tab: any) => {
                    console.log(`Processing tab ${tab.id}:`, tab);

                    if (conversationHistories[tab.id]) {
                        const tabHistory = conversationHistories[tab.id];
                        console.log(`Restoring conversation for tab ${tab.id}:`, tabHistory);

                        restoredTabStates[tab.id] = {
                            messages: tabHistory.messages || [],
                            currentStep: tabHistory.currentStep || 'greeting',
                            searchSessionId: tabHistory.searchSessionId || tab.id,
                            collectedData: (project.collectedData || project.collected_data)?.[tab.id] || {},
                            analysisResult: (project.analysisResults || project.analysis_results)?.[tab.id] || null,
                            // Extended state restoration
                            requirementSchema: tabHistory.requirementSchema || null,
                            validationResult: tabHistory.validationResult || null,
                            currentProductType: tabHistory.currentProductType || null,
                            inputValue: tabHistory.inputValue || '',
                            advancedParameters: tabHistory.advancedParameters || null,
                            selectedAdvancedParams: tabHistory.selectedAdvancedParams || {},
                            fieldDescriptions: tabHistory.fieldDescriptions || (project.fieldDescriptions || project.field_descriptions) || {}
                        };

                        console.log(`Restored state for tab ${tab.id}:`, restoredTabStates[tab.id]);
                    } else {
                        // Create default state for tabs without conversation history
                        restoredTabStates[tab.id] = {
                            messages: [],
                            currentStep: 'greeting',
                            searchSessionId: tab.id,
                            collectedData: {},
                            analysisResult: null,
                            fieldDescriptions: (project.fieldDescriptions || project.field_descriptions) || {}
                        };
                    }
                });

                console.log('Setting restored tab states:', restoredTabStates);
                // Inject project_id into each tab's analysisResult for downstream components
                Object.keys(restoredTabStates).forEach((tabId) => {
                    const ar = restoredTabStates[tabId].analysisResult;
                    if (ar && !ar.projectId) {
                        ar.projectId = projectId;
                    }

                    // Embed pricing data into analysisResult for RightPanel to use
                    if (ar && project.pricing) {
                        // Check if we have pricing data for this specific tab
                        const tabPricing = project.pricing[tabId];
                        if (tabPricing) {
                            console.log(`[LOAD_PROJECT] Embedding pricing data for tab ${tabId}:`, Object.keys(tabPricing).length, 'products');

                            // Embed pricing data into the ranked products
                            if (ar.overallRanking && ar.overallRanking.rankedProducts) {
                                ar.overallRanking.rankedProducts.forEach((product: any) => {
                                    const key = `${product.vendor || product.vendorName || product.vendor_name || ''}-${product.productName || product.product_name || product.name || ''}`.trim();
                                    if (tabPricing[key]) {
                                        console.log(`[LOAD_PROJECT] Embedding pricing for product: ${key}`);
                                        product.priceReview = tabPricing[key];
                                        product.pricing = tabPricing[key];
                                    }
                                });
                            }
                        } else {
                            // If no tab-specific pricing, check if we have general pricing data
                            if (typeof project.pricing === 'object' && !Array.isArray(project.pricing)) {
                                console.log(`[LOAD_PROJECT] Checking general pricing data for tab ${tabId}`);
                                if (ar.overallRanking && ar.overallRanking.rankedProducts) {
                                    ar.overallRanking.rankedProducts.forEach((product: any) => {
                                        const key = `${product.vendor || product.vendorName || product.vendor_name || ''}-${product.productName || product.product_name || product.name || ''}`.trim();
                                        if (project.pricing[key]) {
                                            console.log(`[LOAD_PROJECT] Embedding general pricing for product: ${key}`);
                                            product.priceReview = project.pricing[key];
                                            product.pricing = project.pricing[key];
                                        }
                                    });
                                }
                            }
                        }
                    }
                });
                setTabStates(restoredTabStates);

                // Restore the active tab that was saved
                const savedActiveTab = project.activeTab || project.active_tab;
                if (savedActiveTab) {
                    console.log('Restoring saved active tab:', savedActiveTab);

                    if (savedActiveTab === 'Project' || savedActiveTab === 'project') {
                        setActiveTab('project');
                        setPreviousTab('project');
                    } else {
                        // Try to find tab by title first (new behavior)
                        const tabByTitle = savedSearchTabs.find((t: any) => t.title === savedActiveTab);
                        if (tabByTitle) {
                            setActiveTab(tabByTitle.id);
                            setPreviousTab('project');
                        } else {
                            // Fallback: try to find by ID (legacy behavior)
                            const tabById = savedSearchTabs.find((t: any) => t.id === savedActiveTab);
                            if (tabById) {
                                setActiveTab(tabById.id);
                                setPreviousTab('project');
                            } else {
                                // Default if not found
                                if (savedSearchTabs.length > 0) {
                                    setActiveTab(savedSearchTabs[0].id);
                                    setPreviousTab('project');
                                } else {
                                    setActiveTab('project');
                                    setPreviousTab('project');
                                }
                            }
                        }
                    }
                } else if (savedSearchTabs.length > 0) {
                    console.log('No saved active tab, setting to first search tab:', savedSearchTabs[0].id);
                    setActiveTab(savedSearchTabs[0].id);
                    setPreviousTab('project');
                }
            } else {
                console.log('No search tabs to restore');
                // Clear tab states if no search tabs
                setTabStates({});
            }

            // Only reset to project tab if no search tabs were restored and no active tab was saved
            const savedActiveTab = project.activeTab || project.active_tab;
            if (savedSearchTabs.length === 0 && !savedActiveTab) {
                console.log('No search tabs and no saved active tab, setting active tab to project');
                setActiveTab('project');
                setPreviousTab('project');
            } else {
                console.log('Search tabs or saved active tab found, active tab should be restored above');
            }

            console.log('Project loading completed successfully');

            // Log field descriptions and metadata if available
            const fieldDescriptions = project.fieldDescriptions || project.field_descriptions;
            if (fieldDescriptions) {
                console.log('Project field descriptions loaded:', Object.keys(fieldDescriptions).length, 'fields documented');
                setFieldDescriptions(fieldDescriptions);
            }

            const workflowPosition = project.workflowPosition || project.workflow_position;
            if (workflowPosition) {
                console.log('Project workflow position:', workflowPosition);
            }

            const userInteractions = project.userInteractions || project.user_interactions;
            if (userInteractions) {
                console.log('Project user interactions summary:', userInteractions);
            }

            const projectMetadata = project.projectMetadata || project.project_metadata;
            if (projectMetadata) {
                console.log('Project metadata loaded:', projectMetadata);
            }

            // Set the current project ID for future saves (so it updates instead of creating new)
            console.log('Setting current project ID for updates:', projectId);
            setCurrentProjectId(projectId);

            // Also restore the project's current step if available
            const projectCurrentStep = project.currentStep || project.current_step;
            if (projectCurrentStep) {
                console.log('Project was at step:', projectCurrentStep);
            }

            toast({
                title: "Project Loaded",
                description: `"${project.projectName || project.project_name}" has been loaded successfully. ${savedSearchTabs.length} search tabs restored.`,
            });
        } catch (error: any) {
            toast({
                title: "Load Failed",
                description: error.message || "Failed to load project",
                variant: "destructive",
            });
        }
    };

    // ✅ Save scroll position before leaving Project tab
    const handleTabChange = (newTab: string) => {
        if (activeTab === 'project' && projectScrollRef.current) {
            setSavedScrollPosition(projectScrollRef.current.scrollTop);
        }
        setPreviousTab(activeTab);
        setActiveTab(newTab);
    };

    // ✅ Restore scroll position when returning to Project tab
    useEffect(() => {
        if (activeTab === 'project' && projectScrollRef.current && savedScrollPosition > 0) {
            // Use requestAnimationFrame for more reliable DOM timing
            requestAnimationFrame(() => {
                if (projectScrollRef.current) {
                    projectScrollRef.current.scrollTop = savedScrollPosition;
                }
                // Double-check with a small delay as fallback
                setTimeout(() => {
                    if (projectScrollRef.current && projectScrollRef.current.scrollTop !== savedScrollPosition) {
                        projectScrollRef.current.scrollTop = savedScrollPosition;
                    }
                }, 50);
            });
        }
    }, [activeTab, savedScrollPosition]);

    // Additional effect to handle scroll position restoration after content changes
    useEffect(() => {
        if (activeTab === 'project' && projectScrollRef.current && savedScrollPosition > 0) {
            const timer = setTimeout(() => {
                if (projectScrollRef.current) {
                    projectScrollRef.current.scrollTop = savedScrollPosition;
                }
            }, 150); // Longer delay to ensure content including images is loaded

            return () => clearTimeout(timer);
        }
    }, [activeTab, showResults, instruments, accessories]);

    const resetDuplicateDialog = () => {
        setDuplicateNameDialogOpen(false);
        setDuplicateProjectName(null);
        setAutoRenameSuggestion(null);
        setDuplicateDialogError(null);
    };

    const handleDuplicateNameChangeConfirm = () => {
        const trimmed = (duplicateDialogNameInput || '').trim();
        if (!trimmed) {
            setDuplicateDialogError('Project name is required');
            return;
        }

        resetDuplicateDialog();
        handleSaveProject(trimmed);
    };

    const handleDuplicateNameAutoRename = async () => {
        const baseName = (duplicateProjectName || projectName || '').trim() || 'Project';
        let suggested = autoRenameSuggestion || `${baseName} (1)`;
        try {
            // Try to compute next available suggestion based on existing projects
            const listResp = await fetch(`${BASE_URL}/api/projects`, { credentials: 'include' });
            if (listResp.ok) {
                const listData = await listResp.json();
                suggested = computeNextDuplicateName(baseName, listData.projects || []);
            }
        } catch (e) {
            // ignore and use fallback
        }

        resetDuplicateDialog();

        // Save immediately with the suggested name, and avoid showing the duplicate dialog again for this attempt
        handleSaveProject(suggested, { skipDuplicateDialog: true });
    };

    return (
        <div className="min-h-screen w-full app-glass-gradient flex flex-col">
            {/* Header is now MainHeader */}
            <MainHeader
                rightContent={
                    <>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSaveProject()}
                                    className="rounded-lg p-2 hover:bg-transparent transition-transform hover:scale-[1.2]"
                                >
                                    <Save className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Save</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="sm" onClick={handleNewProject} className="rounded-lg p-2 hover:bg-transparent transition-transform hover:scale-[1.2]">
                                    <FileText className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>New</p></TooltipContent>
                        </Tooltip>

                        <ProjectListDialog
                            open={isProjectListOpen}
                            onOpenChange={setIsProjectListOpen}
                            onProjectSelect={handleOpenProject}
                            onProjectDelete={handleProjectDelete}
                        >
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-lg p-2 hover:bg-transparent transition-transform hover:scale-[1.2]"
                                        onClick={() => setIsProjectListOpen(true)}
                                    >
                                        <FolderOpen className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Open</p></TooltipContent>
                            </Tooltip>
                        </ProjectListDialog>

                        {/* Profile */}
                        <DropdownMenu>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="text-sm font-semibold text-muted-foreground p-2 hover:bg-transparent transition-transform hover:scale-[1.2]"
                                        >
                                            <div className="w-7 h-7 rounded-full bg-[#0F6CBD] flex items-center justify-center text-white font-bold">
                                                {profileButtonLabel.charAt(0)}
                                            </div>
                                        </Button>
                                    </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent><p>Profile</p></TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent
                                className="w-56 mt-1 rounded-xl bg-gradient-to-br from-[#F5FAFC]/90 to-[#EAF6FB]/90 dark:from-slate-900/90 dark:to-slate-900/50 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 shadow-2xl"
                                align="end"
                            >
                                <DropdownMenuLabel className="p-0 font-normal">
                                    <button
                                        onClick={() => setIsProfileEditOpen(true)}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 transition-colors text-sm font-semibold rounded-md text-left outline-none cursor-pointer"
                                        title="Click to edit profile"
                                    >
                                        <User className="w-4 h-4" />
                                        {profileFullName}
                                    </button>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                {user?.role?.toLowerCase() === "admin" && (
                                    <>
                                        <DropdownMenuItem className="flex gap-2 focus:bg-transparent cursor-pointer focus:text-slate-900 dark:focus:text-slate-100" onClick={() => navigate("/admin")}>
                                            <Bot className="h-4 w-4" />
                                            Approve Sign Ups
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="flex gap-2 focus:bg-transparent cursor-pointer focus:text-slate-900 dark:focus:text-slate-100" onClick={() => navigate("/upload")}>
                                            <Upload className="h-4 w-4" />
                                            Upload
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                )}

                                <DropdownMenuItem className="flex gap-2 focus:bg-transparent cursor-pointer focus:text-slate-900 dark:focus:text-slate-100" onClick={logout}>
                                    <LogOut className="h-4 w-4" />
                                    Logout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                }
            >
                {searchTabs.length > 0 && (
                    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                        <TabsList className="w-full bg-transparent p-0 h-auto">
                            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    <TabsTrigger
                                        value="project"
                                        className="rounded-lg px-4 py-2 text-base font-bold text-foreground border-2 border-transparent bg-transparent data-[state=active]:border-white/30 data-[state=active]:bg-white/20 data-[state=active]:backdrop-blur-md whitespace-nowrap flex-shrink-0"
                                    >
                                        {!editingProjectName ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="block">{projectName}</span>
                                                {currentProjectId && (
                                                    <span className="ml-2 text-[10px] text-[#0F6CBD] uppercase tracking-wider font-medium">
                                                        Saved
                                                    </span>
                                                )}
                                                <span
                                                    onClick={(e) => {
                                                        // Prevent tab switch when clicking edit
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        setEditingProjectName(true);
                                                        setTimeout(() => editNameInputRef.current?.focus(), 0);
                                                    }}
                                                    title="Edit project name"
                                                    className="ml-2 text-muted-foreground hover:text-foreground text-sm px-2 py-1 rounded cursor-pointer"
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-label="Edit project name"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            setEditingProjectName(true);
                                                            setTimeout(() => editNameInputRef.current?.focus(), 0);
                                                        }
                                                    }}
                                                >
                                                    ✎
                                                </span>
                                            </span>
                                        ) : (
                                            <input
                                                ref={editNameInputRef}
                                                value={editProjectNameValue}
                                                onChange={(e) => setEditProjectNameValue(e.target.value)}
                                                onBlur={() => {
                                                    const v = (editProjectNameValue || '').trim() || 'Project';
                                                    setProjectName(v);
                                                    setEditingProjectName(false);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const v = (editProjectNameValue || '').trim() || 'Project';
                                                        setProjectName(v);
                                                        setEditingProjectName(false);
                                                    } else if (e.key === 'Escape') {
                                                        setEditProjectNameValue(projectName);
                                                        setEditingProjectName(false);
                                                    }
                                                }}
                                                className="text-sm px-2 py-1 rounded-md border border-border bg-background min-w-[160px]"
                                                autoFocus
                                            />
                                        )}
                                    </TabsTrigger>
                                </div>
                                {searchTabs.map((tab, index) => (
                                    <div key={tab.id} className="flex items-center min-w-0 flex-shrink">
                                        <TabsTrigger
                                            value={tab.id}
                                            className="rounded-lg px-3 py-1 text-sm data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground min-w-0"
                                        >
                                            <span className="truncate block w-full">{tab.title}</span>
                                        </TabsTrigger>
                                        <button
                                            onClick={() => closeSearchTab(tab.id)}
                                            className="ml-1 text-muted-foreground hover:text-foreground text-lg flex-shrink-0"
                                            aria-label={`Close ${tab.title}`}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </TabsList>
                    </Tabs>
                )}
            </MainHeader>

            <ProfileEditDialog
                open={isProfileEditOpen}
                onOpenChange={setIsProfileEditOpen}
            />

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
                            <label htmlFor="duplicate-project-name-input" className="text-sm font-medium">
                                New project name
                            </label>
                            <input
                                id="duplicate-project-name-input"
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
                        <AlertDialogAction
                            onClick={handleDuplicateNameAutoRename}
                        >
                            Use suggested name
                        </AlertDialogAction>
                        <AlertDialogAction onClick={handleDuplicateNameChangeConfirm}>
                            Save new name
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Main Content */}
            <div className="flex-1 relative">
                {/* Right corner dock button - only show on project tab when results are available */}
                {activeTab === 'project' && showResults && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="fixed top-36 right-0 z-50 btn-glass-secondary border-0 shadow-lg rounded-r-none"
                        onClick={() => setIsRightDocked(!isRightDocked)}
                        aria-label={isRightDocked ? "Expand right panel" : "Collapse right panel"}
                    >
                        {isRightDocked ? <ChevronLeft /> : <ChevronRight />}
                    </Button>
                )}

                <div className="w-full h-full flex">
                    {/* Main Content Area - Always mounted, use CSS to show/hide */}
                    <div className={`${activeTab === 'project' ? 'contents' : 'hidden'}`}>
                        <>
                            {/* Centered Input Section */}
                            <div className={`transition-all duration-500 ease-in-out ${!isRightDocked && showResults ? 'w-1/2' : 'w-full'} h-screen overflow-y-auto custom-no-scrollbar pt-24`} ref={projectScrollRef}>
                                {/* Initial Welcome Screen - with glass-card wrapper */}
                                {chatMessages.length === 0 ? (
                                    <div className="mx-auto max-w-[900px] px-4 md:px-6 min-h-full flex items-center justify-center">
                                        <div className="w-full p-4 md:p-6 glass-card animate-in fade-in duration-500 my-6">

                                            {/* Header - Only show when no chat messages */}
                                            {chatMessages.length === 0 && (
                                                <>
                                                    <div className="text-center mb-6">
                                                        <div className="flex items-center justify-center gap-4 mb-4">
                                                            <div className="w-16 h-16 rounded-full overflow-hidden shadow">
                                                                <video
                                                                    src="/animation.mp4"
                                                                    autoPlay
                                                                    muted
                                                                    playsInline
                                                                    disablePictureInPicture
                                                                    controls={false}
                                                                    onContextMenu={(e) => e.preventDefault()}
                                                                    onError={(e) => {
                                                                        // Retry loading on error (handles 304 cache issues)
                                                                        const video = e.currentTarget;
                                                                        video.load();
                                                                        video.play().catch(() => { });
                                                                    }}
                                                                    className="w-full h-full object-cover pointer-events-none"
                                                                />
                                                            </div>
                                                            <h1 className="text-4xl font-bold text-foreground">
                                                                EnGenie
                                                            </h1>
                                                        </div>
                                                    </div>

                                                    {!showResults && (
                                                        <div className="text-center space-y-4 mb-8">
                                                            <h2 className="text-3xl font-normal text-muted-foreground">
                                                                Welcome, <span className="text-primary font-bold text-4xl">{user?.firstName || user?.username || 'User'}</span>! what are your requirements
                                                            </h2>
                                                        </div>
                                                    )}
                                                </>
                                            )}


                                            {/* Bouncing Dots when loading */}
                                            {showThinking && (
                                                <div className="mb-4">
                                                    <div className="flex justify-start">
                                                        <div className="max-w-[80%] flex items-start space-x-2">
                                                            <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-transparent">
                                                                <img
                                                                    src="/icon-engenie.png"
                                                                    alt="Assistant"
                                                                    className="w-14 h-14 object-contain"
                                                                />
                                                            </div>
                                                            <div className="p-3 rounded-lg">
                                                                <BouncingDots />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Input Form */}
                                            <form onSubmit={handleSubmit}>
                                                <div className="relative group">
                                                    <div className={`relative w-full rounded-[26px] transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-transparent hover:scale-[1.02] flex flex-col`}
                                                        style={{
                                                            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                                                            WebkitBackdropFilter: 'blur(12px)',
                                                            backdropFilter: 'blur(12px)',
                                                            backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                                            border: '1px solid rgba(255, 255, 255, 0.4)',
                                                            color: 'rgba(0, 0, 0, 0.8)'
                                                        }}>
                                                        <Textarea
                                                            value={requirements}
                                                            onChange={(e) => setRequirements(e.target.value)}
                                                            onKeyDown={handleKeyPress}
                                                            className={`w-full bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70 resize-none text-base p-4 md:p-6 text-lg leading-relaxed shadow-none custom-no-scrollbar ${showResults ? 'min-h-[80px]' : 'min-h-[120px]'}`}
                                                            style={{
                                                                backgroundColor: 'transparent',
                                                                boxShadow: 'none',
                                                                color: 'inherit'
                                                            }}
                                                            placeholder="Describe the product you are looking for..."
                                                            disabled={isLoading}
                                                        />

                                                        {/* File Display & Buttons Bar - Footer inside the glass box */}
                                                        <div className="flex items-center justify-between px-4 pb-4 md:px-6 md:pb-6 pt-2">
                                                            <div className="flex items-center gap-2">
                                                                {/* Attached File Badge - visible before submit */}
                                                                {attachedFile && (
                                                                    <div className="flex items-center gap-2 p-1.5 px-3 glass-card bg-primary/10 border-0 rounded-full text-xs">
                                                                        {isExtracting ? (
                                                                            <Loader2 className="h-3 w-3 text-primary animate-spin" />
                                                                        ) : (
                                                                            <FileText className="h-3 w-3 text-primary" />
                                                                        )}
                                                                        <span className="text-primary truncate max-w-[100px]">{attachedFile.name}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={handleRemoveFile}
                                                                            className="text-primary/70 hover:text-primary"
                                                                            title="Remove file"
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {/* Hidden file input */}
                                                                <input
                                                                    ref={fileInputRef}
                                                                    type="file"
                                                                    accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.bmp,.tiff"
                                                                    onChange={handleFileSelect}
                                                                    className="hidden"
                                                                />
                                                            </div>

                                                            {/* Action Buttons */}
                                                            <div className="flex items-center gap-1">
                                                                {/* Attach Button */}
                                                                <Button
                                                                    type="button"
                                                                    onClick={() => fileInputRef.current?.click()}
                                                                    disabled={isLoading || isExtracting}
                                                                    className="w-8 h-8 rounded-full hover:bg-transparent transition-all duration-300 flex-shrink-0 text-muted-foreground hover:text-primary hover:scale-110"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    title="Attach file"
                                                                >
                                                                    <Upload className="h-4 w-4" />
                                                                </Button>

                                                                {/* Submit Button */}
                                                                <Button
                                                                    type="submit"
                                                                    disabled={isLoading || isExtracting || (!requirements.trim() && !extractedText.trim())}
                                                                    className={`w-8 h-8 p-0 rounded-full transition-all duration-300 flex-shrink-0 hover:bg-transparent ${(!requirements.trim() && !extractedText.trim()) ? 'text-muted-foreground' : 'text-primary hover:scale-110'}`}
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    title="Submit"
                                                                >
                                                                    {isLoading || isExtracting ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                                    ) : (
                                                                        <Send className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                ) : (
                                    /* Full Screen Chat Mode - Matching ChatInterface layout exactly */
                                    <div className="flex-1 flex flex-col h-full bg-transparent relative">
                                        {/* Header with Logo and EnGenie name - Same as ChatInterface */}
                                        <div className="flex-none py-0 border-b border-white/10 bg-transparent z-20 flex justify-center items-center">
                                            <div className="flex items-center gap-1">
                                                <div className="flex items-center justify-center">
                                                    <img
                                                        src="/icon-engenie.png"
                                                        alt="EnGenie"
                                                        className="w-16 h-16 object-contain"
                                                    />
                                                </div>
                                                <h1 className="text-3xl font-bold text-[#0f172a]">
                                                    EnGenie
                                                </h1>
                                            </div>
                                        </div>

                                        {/* Chat Messages Area - Same padding as ChatInterface */}
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-no-scrollbar pb-32">
                                            {chatMessages.map((message) => (
                                                <MessageRow
                                                    key={message.id}
                                                    message={message}
                                                    isHistory={isHistoryRef.current}
                                                />
                                            ))}

                                            {/* Bouncing Dots Loading Indicator */}
                                            {showThinking && (
                                                <div className="flex justify-start">
                                                    <div className="max-w-[80%] flex items-start space-x-2">
                                                        <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-transparent">
                                                            <img
                                                                src="/icon-engenie.png"
                                                                alt="Assistant"
                                                                className="w-14 h-14 object-contain"
                                                            />
                                                        </div>
                                                        <div className="p-3 rounded-lg">
                                                            <BouncingDots />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Input Form - Fixed at bottom like ChatInterface */}
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-transparent">
                                            <div className="max-w-4xl mx-auto px-2 md:px-8">
                                                <form onSubmit={handleSubmit}>
                                                    <div className="relative group">
                                                        <div className={`relative w-full rounded-[26px] transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-transparent hover:scale-[1.02]`}
                                                            style={{
                                                                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                                                                WebkitBackdropFilter: 'blur(12px)',
                                                                backdropFilter: 'blur(12px)',
                                                                backgroundColor: '#ffffff',
                                                                border: '1px solid rgba(255, 255, 255, 0.4)',
                                                                color: 'rgba(0, 0, 0, 0.8)'
                                                            }}>
                                                            <textarea
                                                                value={requirements}
                                                                onChange={(e) => setRequirements(e.target.value)}
                                                                onKeyDown={handleKeyPress}
                                                                className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none px-4 py-2.5 pr-20 text-sm resize-none min-h-[40px] max-h-[200px] leading-relaxed flex items-center custom-no-scrollbar"
                                                                style={{
                                                                    fontSize: '16px',
                                                                    fontFamily: 'inherit',
                                                                    boxShadow: 'none',
                                                                    overflowY: 'auto'
                                                                }}
                                                                placeholder="Type your message here..."
                                                                disabled={isLoading}
                                                            />

                                                            {/* Attached File Badge - visible before submit */}
                                                            {attachedFile && (
                                                                <div className="absolute bottom-1.5 left-3 flex items-center gap-2 p-1 px-2 bg-primary/10 rounded-full text-xs">
                                                                    {isExtracting ? (
                                                                        <Loader2 className="h-3 w-3 text-primary animate-spin" />
                                                                    ) : (
                                                                        <FileText className="h-3 w-3 text-primary" />
                                                                    )}
                                                                    <span className="text-primary truncate max-w-[80px]">{attachedFile.name}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleRemoveFile}
                                                                        className="text-primary/70 hover:text-primary"
                                                                        title="Remove file"
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* Action Buttons - positioned like ChatInterface */}
                                                            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5">
                                                                {/* Attach Button */}
                                                                <Button
                                                                    type="button"
                                                                    onClick={() => fileInputRef.current?.click()}
                                                                    disabled={isLoading || isExtracting}
                                                                    className="w-8 h-8 rounded-full hover:bg-transparent transition-all duration-300 flex-shrink-0 text-muted-foreground hover:text-primary hover:scale-110"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    title="Attach file"
                                                                >
                                                                    <Upload className="h-4 w-4" />
                                                                </Button>

                                                                {/* Submit Button */}
                                                                <Button
                                                                    type="submit"
                                                                    disabled={isLoading || isExtracting || (!requirements.trim() && !extractedText.trim())}
                                                                    className={`w-8 h-8 p-0 rounded-full transition-all duration-300 flex-shrink-0 hover:bg-transparent ${(!requirements.trim() && !extractedText.trim()) ? 'text-muted-foreground' : 'text-primary hover:scale-110'}`}
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    title="Submit"
                                                                >
                                                                    {isLoading || isExtracting ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                                    ) : (
                                                                        <Send className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </div>

                                                    </div>

                                                    {/* Hidden file input */}
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.bmp,.tiff"
                                                        onChange={handleFileSelect}
                                                        className="hidden"
                                                    />
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Panel - Results */}
                            {showResults && (
                                <div className={`
                                    h-screen border-l border-slate-300 dark:border-slate-600 bg-gradient-to-br from-[#F5FAFC]/40 to-[#EAF6FB]/40 
                                    overflow-y-auto custom-no-scrollbar pt-36
                                    transition-all duration-500 ease-in-out origin-right
                                    ${!isRightDocked ? 'w-1/2 opacity-100' : 'w-0 opacity-0 border-l-0 overflow-hidden'}
                                `}>
                                    <div className="w-full min-w-[45vw] p-6">
                                        {/* Results Display */}
                                        <div className="space-y-6">
                                            {/* Instruments Section */}
                                            {instruments.length > 0 && (
                                                <>
                                                    <div className="mb-6">
                                                        <h2 className="text-2xl font-bold">
                                                            Instruments ({instruments.length})
                                                        </h2>
                                                    </div>

                                                    <div className="space-y-4">
                                                        {instruments.map((instrument, index) => (
                                                            <div
                                                                key={index}
                                                                className="rounded-xl bg-gradient-to-br from-[#F5FAFC]/90 to-[#EAF6FB]/90 dark:from-slate-900/90 dark:to-slate-900/50 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 shadow-2xl transition-all duration-300 ease-in-out hover:scale-[1.01] p-8 space-y-6"
                                                            >
                                                                {/* Category (primary) and Product Name (secondary) - smart category for accessories */}
                                                                <div className="flex items-start justify-between">
                                                                    <div className="space-y-1">
                                                                        <h3 className="text-xl font-semibold">
                                                                            {index + 1}. {(() => {
                                                                                // If category is generic like "Accessories", extract the type from productName
                                                                                const cat = instrument.category || '';
                                                                                const name = instrument.productName || '';
                                                                                const isGeneric = cat.toLowerCase() === 'accessories' || cat.toLowerCase() === 'accessory';
                                                                                if (isGeneric && name) {
                                                                                    // Extract first part before "for" (e.g., "Thermowell for X" -> "Thermowell")
                                                                                    const parts = name.split(' for ');
                                                                                    return parts[0] || name;
                                                                                }
                                                                                return cat || name;
                                                                            })()}{instrument.quantity ? ` (${instrument.quantity})` : ''}
                                                                        </h3>
                                                                        <p className="text-muted-foreground">
                                                                            {instrument.productName}
                                                                        </p>
                                                                    </div>
                                                                    <Button
                                                                        onClick={() => handleRun(instrument, index)}
                                                                        className="rounded-xl w-10 h-10 p-0 flex items-center justify-center bg-primary/40 hover:bg-primary text-primary hover:text-white transition-all duration-300 hover:scale-110"
                                                                        variant="ghost"
                                                                    >
                                                                        <Play className="h-4 w-4" />
                                                                    </Button>
                                                                </div>

                                                                {/* Generic Product Type Image */}
                                                                {genericImages[instrument.productName] && (
                                                                    <div className="flex justify-center my-4 rounded-lg overflow-hidden">
                                                                        <img
                                                                            src={genericImages[instrument.productName]}
                                                                            alt={`Generic ${instrument.category}`}
                                                                            className="w-48 h-48 object-contain rounded-lg mix-blend-multiply"
                                                                            onError={(e) => {
                                                                                e.currentTarget.style.display = 'none';
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}

                                                                {/* Specifications */}
                                                                {Object.keys(instrument.specifications).length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <h4 className="font-medium text-sm text-muted-foreground">
                                                                            Specifications:
                                                                        </h4>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                            {Object.entries(instrument.specifications).map(([key, value]) => {
                                                                                const prettyKey = prettifyKey(key);
                                                                                // Check for description in fieldDescriptions (try multiple key formats)
                                                                                const description =
                                                                                    fieldDescriptions[key] ||
                                                                                    fieldDescriptions[prettyKey] ||
                                                                                    fieldDescriptions[key.toLowerCase()] ||
                                                                                    fieldDescriptions[key.replace(/_/g, ' ')] ||
                                                                                    null;

                                                                                return (
                                                                                    <div key={key} className="text-sm group break-words">
                                                                                        {description ? (
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger asChild>
                                                                                                    <span className="font-medium cursor-help border-b border-dotted border-muted-foreground/50 hover:text-primary transition-colors">
                                                                                                        {prettyKey}:
                                                                                                    </span>
                                                                                                </TooltipTrigger>
                                                                                                <TooltipContent side="top" className="max-w-[300px] p-3 text-sm bg-popover/95 backdrop-blur-md border border-border shadow-xl">
                                                                                                    <p>{description}</p>
                                                                                                </TooltipContent>
                                                                                            </Tooltip>
                                                                                        ) : (
                                                                                            <span className="font-medium">{prettyKey}:</span>
                                                                                        )}{' '}
                                                                                        <span className="text-muted-foreground">{value}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Sample Input Preview */}
                                                                <div className="pt-3 border-t">
                                                                    <p className="text-xs text-muted-foreground mb-2">Sample Input:</p>
                                                                    <p className="text-sm bg-muted p-3 rounded-lg font-mono">
                                                                        {instrument.sampleInput}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}

                                            {/* Accessories Section */}
                                            {accessories.length > 0 && (
                                                <>
                                                    <h2 className="text-2xl font-bold mt-8">
                                                        Accessories ({accessories.length})
                                                    </h2>

                                                    <div className="space-y-4 mt-4">
                                                        {accessories.map((accessory, index) => (
                                                            <div
                                                                key={index}
                                                                className="rounded-xl bg-gradient-to-br from-[#F5FAFC]/90 to-[#EAF6FB]/90 dark:from-slate-900/90 dark:to-slate-900/50 backdrop-blur-2xl border border-white/20 dark:border-slate-700/30 shadow-2xl transition-all duration-300 ease-in-out hover:scale-[1.02] p-6 space-y-4"
                                                            >
                                                                {/* Accessory Category (primary) and Name (secondary) - extract type from name if category is generic */}
                                                                <div className="flex items-start justify-between">
                                                                    <div className="space-y-1">
                                                                        <h3 className="text-xl font-semibold">
                                                                            {index + 1}. {(() => {
                                                                                // If category is generic like "Accessories", extract the type from accessoryName
                                                                                const cat = accessory.category || '';
                                                                                const name = accessory.accessoryName || '';
                                                                                const isGeneric = cat.toLowerCase() === 'accessories' || cat.toLowerCase() === 'accessory';
                                                                                if (isGeneric && name) {
                                                                                    // Extract first part before "for" (e.g., "Thermowell for X" -> "Thermowell")
                                                                                    const parts = name.split(' for ');
                                                                                    return parts[0] || name;
                                                                                }
                                                                                return cat || name;
                                                                            })()}{accessory.quantity ? ` (${accessory.quantity})` : ''}
                                                                        </h3>
                                                                        <p className="text-muted-foreground">
                                                                            {accessory.accessoryName}
                                                                        </p>
                                                                    </div>
                                                                    <Button
                                                                        onClick={() => handleRunAccessory(accessory, index)}
                                                                        className="rounded-xl w-10 h-10 p-0 flex items-center justify-center bg-primary/40 hover:bg-primary text-primary hover:text-white transition-all duration-300 hover:scale-110"
                                                                        variant="ghost"
                                                                    >
                                                                        <Play className="h-4 w-4" />
                                                                    </Button>
                                                                </div>

                                                                {/* Generic Product Type Image */}
                                                                {genericImages[accessory.accessoryName] && (
                                                                    <div className="flex justify-center my-4 rounded-lg overflow-hidden">
                                                                        <img
                                                                            src={genericImages[accessory.accessoryName]}
                                                                            alt={`Generic ${accessory.category}`}
                                                                            className="w-48 h-48 object-contain rounded-lg mix-blend-multiply"
                                                                            onError={(e) => {
                                                                                e.currentTarget.style.display = 'none';
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}

                                                                {/* Specifications */}
                                                                {Object.keys(accessory.specifications).length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <h4 className="font-medium text-sm text-muted-foreground">
                                                                            Specifications:
                                                                        </h4>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                            {Object.entries(accessory.specifications).map(([key, value]) => {
                                                                                const prettyKey = prettifyKey(key);
                                                                                // Check for description in fieldDescriptions
                                                                                const description =
                                                                                    fieldDescriptions[key] ||
                                                                                    fieldDescriptions[prettyKey] ||
                                                                                    fieldDescriptions[key.toLowerCase()] ||
                                                                                    fieldDescriptions[key.replace(/_/g, ' ')] ||
                                                                                    null;

                                                                                return (
                                                                                    <div key={key} className="text-sm group break-words">
                                                                                        {description ? (
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger asChild>
                                                                                                    <span className="font-medium cursor-help border-b border-dotted border-muted-foreground/50 hover:text-primary transition-colors">
                                                                                                        {prettyKey}:
                                                                                                    </span>
                                                                                                </TooltipTrigger>
                                                                                                <TooltipContent side="top" className="max-w-[300px] p-3 text-sm bg-popover/95 backdrop-blur-md border border-border shadow-xl">
                                                                                                    <p>{description}</p>
                                                                                                </TooltipContent>
                                                                                            </Tooltip>
                                                                                        ) : (
                                                                                            <span className="font-medium">{prettyKey}:</span>
                                                                                        )}{' '}
                                                                                        <span className="text-muted-foreground">{value}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Sample Input Preview */}
                                                                <div className="pt-3 border-t">
                                                                    <p className="text-xs text-muted-foreground mb-2">Sample Input:</p>
                                                                    <p className="text-sm bg-muted p-3 rounded-lg font-mono">
                                                                        {accessory.sampleInput}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    </div>
                </div>

                {/* Search Tabs - positioned absolutely relative to the flex-1 relative container */}
                {searchTabs.map((tab) => {
                    const savedState = tabStates[tab.id];
                    console.log(`Rendering AIRecommender for tab ${tab.id} with saved state:`, savedState);
                    return (
                        <div
                            key={tab.id}
                            className={`absolute inset-0 top-24 ${activeTab === tab.id ? 'block' : 'hidden'}`}
                        >
                            <AIRecommender
                                key={tab.id}
                                initialInput={tab.input}
                                isDirectSearch={tab.isDirectSearch}
                                productType={tab.productType}
                                itemThreadId={tab.itemThreadId}
                                workflowThreadId={tab.workflowThreadId}
                                mainThreadId={tab.mainThreadId}
                                fillParent
                                onStateChange={(state) => handleTabStateChange(tab.id, state)}
                                savedMessages={savedState?.messages}
                                savedCollectedData={savedState?.collectedData}
                                savedCurrentStep={savedState?.currentStep}
                                savedAnalysisResult={savedState?.analysisResult}
                                savedRequirementSchema={savedState?.requirementSchema}
                                savedValidationResult={savedState?.validationResult}
                                savedCurrentProductType={savedState?.currentProductType}
                                savedInputValue={savedState?.inputValue}
                                savedAdvancedParameters={savedState?.advancedParameters}
                                savedSelectedAdvancedParams={savedState?.selectedAdvancedParams}
                                savedFieldDescriptions={savedState?.fieldDescriptions}
                                savedPricingData={savedState?.pricingData}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Project;
