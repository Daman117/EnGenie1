/**
 * ThreadManagementExample.tsx
 *
 * Example React components showing how to use the UI-managed thread system
 * Demonstrates:
 * - Session creation at login
 * - Sub-thread creation for workflows
 * - Item thread tracking
 * - Product search with separate thread
 * - Multi-window management
 */

import React, { useState } from 'react';
import {
  useThread,
  useSessionMetadata,
  useActiveSubThread,
  useThreadIds,
} from '../contexts/ThreadContext';
import { apiClient } from '../../services/api/ThreadAwareApiClient';

// ============================================================================
// EXAMPLE 1: Login Component
// ============================================================================

export const LoginExample: React.FC = () => {
  const { createSession, getAllActiveSessions } = useThread();
  const [userId, setUserId] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Authenticate user (your auth logic here)
    const user = { id: userId };

    // 2. Create session with UI-managed thread IDs
    const session = createSession(user.id, 'US-WEST');

    if (session) {
      console.log('Session created:', {
        sessionId: session.sessionId,
        mainThreadId: session.mainThreadId,
      });

      // 3. Navigate to home page
      // navigate('/home');
    }
  };

  const activeSessions = getAllActiveSessions();

  return (
    <div className="login-container">
      <h2>AIPR Login</h2>

      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <button type="submit">Login</button>
      </form>

      <div className="active-sessions">
        <h3>Active Sessions ({activeSessions.length})</h3>
        {activeSessions.map((session) => (
          <div key={session.sessionId} className="session-card">
            <p>User: {session.userId}</p>
            <p>Main Thread: {session.mainThreadId.substring(0, 30)}...</p>
            <p>Windows Open: {session.activeWindowCount}</p>
            <p>Sub-Threads: {session.subThreadCount}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// EXAMPLE 2: Instrument Identifier Component
// ============================================================================

interface IdentifiedItem {
  number: number;
  name: string;
  type: 'instrument' | 'accessory';
  category: string;
}

export const InstrumentIdentifierExample: React.FC = () => {
  const { createSubThread, addItemThread, setActiveSubThread } = useThread();
  const { mainThreadId, subThreadId } = useThreadIds();
  const [requirements, setRequirements] = useState('');
  const [items, setItems] = useState<IdentifiedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create sub-thread for this workflow
      const subThread = createSubThread('instrument_identifier');

      if (!subThread) {
        throw new Error('Failed to create sub-thread');
      }

      console.log('Sub-thread created:', subThread.subThreadId);

      // 2. Call API (thread context auto-injected)
      const response = await apiClient.runInstrumentIdentifier(requirements);

      // 3. Process response
      const identifiedItems = response.data.response_data.items;
      setItems(identifiedItems);

      // 4. Create item threads for each identified item
      identifiedItems.forEach((item: IdentifiedItem) => {
        const itemThreadId = addItemThread(
          subThread.subThreadId,
          item.number,
          item.name,
          item.type
        );

        console.log(
          `Item thread created: ${item.name} -> ${itemThreadId?.substring(0, 30)}...`
        );
      });

      setActiveSubThread(subThread.subThreadId);
    } catch (error) {
      console.error('Error identifying instruments:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="instrument-identifier-container">
      <h2>Instrument Identifier</h2>

      <form onSubmit={handleIdentify}>
        <textarea
          placeholder="Enter process requirements..."
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          rows={5}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Identifying...' : 'Identify Instruments'}
        </button>
      </form>

      {subThreadId && (
        <div className="thread-info">
          <p>Main Thread: {mainThreadId?.substring(0, 30)}...</p>
          <p>Active Sub-Thread: {subThreadId.substring(0, 30)}...</p>
        </div>
      )}

      <div className="items-list">
        <h3>Identified Items ({items.length})</h3>
        {items.map((item) => (
          <div key={item.number} className="item-card">
            <h4>
              {item.number}. {item.name}
            </h4>
            <p>Type: {item.type}</p>
            <p>Category: {item.category}</p>
            <button
              onClick={() => handleSelectItem(item.number, item.name)}
            >
              Search Products
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  async function handleSelectItem(itemNumber: number, itemName: string) {
    // This triggers a new product search window/thread
    console.log(`Searching for: ${itemName}`);
    // Would create a new product_search sub-thread
  }
};

// ============================================================================
// EXAMPLE 3: Product Search Component
// ============================================================================

interface Product {
  id: string;
  name: string;
  vendor: string;
  price: number;
  specs: Record<string, any>;
}

interface ProductSearchProps {
  itemThreadId: string;
  itemName: string;
  itemNumber: number;
  parentWorkflowThreadId: string;
}

export const ProductSearchExample: React.FC<ProductSearchProps> = ({
  itemThreadId,
  itemName,
  itemNumber,
  parentWorkflowThreadId,
}) => {
  const { createProductSearchSubThread } = useThread();
  const { mainThreadId, subThreadId } = useThreadIds();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);

    try {
      // 1. Create product_search sub-thread
      const searchThread = createProductSearchSubThread(
        parentWorkflowThreadId,
        itemNumber,
        itemThreadId
      );

      if (!searchThread) {
        throw new Error('Failed to create product search thread');
      }

      console.log('Product search thread created:', searchThread.subThreadId);

      // 2. Call API (will use new product_search sub-thread)
      const response = await apiClient.searchProducts(
        parentWorkflowThreadId,
        itemNumber,
        itemName,
        {} // requirements
      );

      // 3. Display results
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = async (product: Product) => {
    setSelectedProduct(product);

    try {
      // Product selection creates separate API call
      const response = await apiClient.selectProduct(
        subThreadId || '',
        itemNumber,
        product
      );

      console.log('Product selected:', product.name);
      console.log('Thread ID:', subThreadId);
    } catch (error) {
      console.error('Error selecting product:', error);
    }
  };

  return (
    <div className="product-search-container">
      <h2>Search Products for {itemName}</h2>

      <div className="thread-info">
        <p>Item Thread: {itemThreadId.substring(0, 30)}...</p>
        <p>
          Active Sub-Thread:{' '}
          {subThreadId?.substring(0, 30) || 'Not set'}...
        </p>
      </div>

      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Search Products'}
      </button>

      <div className="products-grid">
        {products.map((product) => (
          <div key={product.id} className="product-card">
            <h4>{product.name}</h4>
            <p>Vendor: {product.vendor}</p>
            <p>Price: ${product.price}</p>
            <button
              onClick={() => handleSelectProduct(product)}
              className={selectedProduct?.id === product.id ? 'selected' : ''}
            >
              {selectedProduct?.id === product.id
                ? '✓ Selected'
                : 'Select'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// EXAMPLE 4: Multi-Window Management
// ============================================================================

interface OpenWindow {
  subThreadId: string;
  workflowType: string;
  itemCount: number;
}

export const MultiWindowManagerExample: React.FC = () => {
  const { currentSession, updateWindowCount, subThreads } = useThread();
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);

  // Track windows
  const handleOpenNewWindow = (workflowType: string) => {
    const newWindow: OpenWindow = {
      subThreadId: `${workflowType}_${Date.now()}`,
      workflowType,
      itemCount: 0,
    };

    setOpenWindows([...openWindows, newWindow]);
    updateWindowCount(openWindows.length + 1);

    console.log(`Opened window: ${workflowType}`);
  };

  const handleCloseWindow = (subThreadId: string) => {
    setOpenWindows(openWindows.filter((w) => w.subThreadId !== subThreadId));
    updateWindowCount(openWindows.length - 1);

    console.log(`Closed window: ${subThreadId}`);
  };

  if (!currentSession) {
    return <div>No active session</div>;
  }

  return (
    <div className="window-manager-container">
      <h2>Window Manager</h2>

      <div className="session-summary">
        <p>Session: {currentSession.sessionId.substring(0, 20)}...</p>
        <p>Main Thread: {currentSession.mainThreadId.substring(0, 30)}...</p>
        <p>Windows Open: {currentSession.windowCount}</p>
        <p>Sub-Threads: {currentSession.subThreads.size}</p>
      </div>

      <div className="window-controls">
        <button onClick={() => handleOpenNewWindow('instrument_identifier')}>
          + New Instrument ID
        </button>
        <button onClick={() => handleOpenNewWindow('solution')}>
          + New Solution
        </button>
        <button onClick={() => handleOpenNewWindow('grounded_chat')}>
          + New Chat
        </button>
      </div>

      <div className="open-windows">
        <h3>Open Windows ({openWindows.length})</h3>
        {openWindows.map((window) => (
          <div key={window.subThreadId} className="window-card">
            <p>{window.workflowType}</p>
            <p>Items: {window.itemCount}</p>
            <button onClick={() => handleCloseWindow(window.subThreadId)}>
              Close
            </button>
          </div>
        ))}
      </div>

      <div className="sub-threads-tree">
        <h3>Sub-Threads Hierarchy</h3>
        {Array.from(subThreads?.entries() || []).map(([key, subThread]) => (
          <div key={key} className="sub-thread-node">
            <p>
              {subThread.workflowType} ({subThread.itemThreads.size} items)
            </p>
            <ul>
              {Array.from(subThread.itemThreads.entries()).map(
                ([itemNum, threadId]) => (
                  <li key={itemNum}>
                    Item {itemNum}: {threadId.substring(0, 30)}...
                  </li>
                )
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// EXAMPLE 5: Session Recovery (on page reload)
// ============================================================================

export const SessionRecoveryExample: React.FC = () => {
  const { restoreSession, isSessionActive } = useThread();

  React.useEffect(() => {
    // On app initialization
    const savedSessionId = localStorage.getItem('lastSessionId');

    if (savedSessionId && !isSessionActive) {
      console.log('Attempting to restore session:', savedSessionId);

      const restored = restoreSession(savedSessionId);

      if (restored) {
        console.log('Session restored successfully!');
        console.log('Main Thread:', restored.mainThreadId);
        console.log('Sub-threads:', restored.subThreads.size);
      } else {
        console.log('Failed to restore session - redirecting to login');
        // navigate('/login');
      }
    }
  }, [isSessionActive, restoreSession]);

  if (!isSessionActive) {
    return <div>Restoring session...</div>;
  }

  return <div>Session active!</div>;
};

// ============================================================================
// EXAMPLE 6: Debug Panel
// ============================================================================

export const DebugPanelExample: React.FC = () => {
  const { currentSession, sessionMetadata, getAllActiveSessions } =
    useThread();
  const { mainThreadId, subThreadId, sessionId, zone } = useThreadIds();

  return (
    <div className="debug-panel" style={{ borderLeft: '3px solid #ff6b6b' }}>
      <h3>🐛 Debug Panel</h3>

      <div className="debug-section">
        <h4>Current Thread IDs</h4>
        <pre>
          {JSON.stringify(
            {
              mainThreadId,
              subThreadId,
              sessionId,
              zone,
            },
            null,
            2
          )}
        </pre>
      </div>

      {sessionMetadata && (
        <div className="debug-section">
          <h4>Session Metadata</h4>
          <pre>{JSON.stringify(sessionMetadata, null, 2)}</pre>
        </div>
      )}

      {currentSession && (
        <div className="debug-section">
          <h4>Sub-Threads Tree</h4>
          <pre>
            {JSON.stringify(
              Array.from(currentSession.subThreads.entries()).map(
                ([key, subThread]) => ({
                  [key]: {
                    workflowType: subThread.workflowType,
                    status: subThread.status,
                    itemCount: subThread.itemThreads.size,
                    items: Array.from(subThread.itemThreads.entries()),
                  },
                })
              ),
              null,
              2
            )}
          </pre>
        </div>
      )}

      <div className="debug-section">
        <h4>All Active Sessions</h4>
        <pre>{JSON.stringify(getAllActiveSessions(), null, 2)}</pre>
      </div>
    </div>
  );
};

export default {
  LoginExample,
  InstrumentIdentifierExample,
  ProductSearchExample,
  MultiWindowManagerExample,
  SessionRecoveryExample,
  DebugPanelExample,
};
