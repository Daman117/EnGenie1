import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { checkAuth, login as apiLogin, logout as apiLogout, signup as apiSignup } from '../components/AIRecommender/api';
import { UserCredentials } from '../components/AIRecommender/types';
import { useToast } from '../hooks/use-toast';
import { getSessionManager } from '../services/SessionManager';

// UPDATED User interface to include role and status
interface User {
  username: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: "admin" | "user";        // change to union type for safety
  status: "pending" | "active" | "rejected";  // 'pending', 'active', or 'rejected'
  companyName?: string;
  location?: string;
  strategyInterest?: string;
  documentFileId?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;

  user: User | null;
  isAdmin: boolean;          // added here
  refreshUser: () => Promise<void>;
  login: (credentials: Omit<UserCredentials, 'email'>) => Promise<void>;
  signup: (credentials: UserCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const { toast } = useToast();

  const checkAuthStatus = async () => {
    try {
      const authData = await checkAuth();
      setIsAuthenticated(!!authData);
      if (authData) {
        // Type cast to the new User interface
        setUser(authData.user as User);

        // Ensure thread session exists for authenticated user
        const sessionManager = getSessionManager();
        if (!sessionManager.getCurrentSession()) {
          await sessionManager.getOrCreateSession(authData.user.username || authData.user.email);
          console.log('[AUTH] Thread session restored for authenticated user');
        }
      }
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const refreshUser = async () => {
    await checkAuthStatus();
  };

  const login = async (credentials: Omit<UserCredentials, 'email'>) => {
    try {
      setIsLoading(true);
      const response = await apiLogin(credentials);
      setIsAuthenticated(true);
      // Set the user with the new role and status
      setUser(response.user as User);

      // Create thread session for UI-managed thread system
      const sessionManager = getSessionManager();
      await sessionManager.getOrCreateSession(response.user.username || response.user.email);
      console.log('[AUTH] Thread session created for user:', response.user.username);

      toast({
        title: "Success",
        description: "Successfully logged in!",
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || "Invalid credentials";
      let description = errorMessage;
      if (error.response?.status === 403) {
        // Status 403 means user is not active (pending or rejected)
        if (errorMessage.toLowerCase().includes("pending")) {
          description = "Your account is pending admin approval.";
        } else if (errorMessage.toLowerCase().includes("rejected")) {
          description = "Your account has been rejected. Please contact support.";
        }
      }
      toast({
        title: "Login Failed",
        description,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (credentials: UserCredentials) => {
    try {
      setIsLoading(true);
      const response = await apiSignup(credentials);
      // The signup message now indicates admin approval is needed
      toast({
        title: "Success",
        description: response.message || "Account created successfully! Awaiting admin approval.",
      });
    } catch (error: any) {
      toast({
        title: "Signup Failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await apiLogout();
      setIsAuthenticated(false);
      setUser(null);

      // End thread session (clears if not saved)
      const sessionManager = getSessionManager();
      sessionManager.endSession();
      console.log('[AUTH] Thread session ended');

      toast({
        title: "Success",
        description: "Successfully logged out!",
      });
    } catch (error: any) {
      toast({
        title: "Logout Failed",
        description: error.message || "Failed to logout",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    user,
    isAdmin: user?.role === "admin",   // added helper
    refreshUser,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
