import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authManager from '@/handler/AuthManager';
import { User } from '@/types'; // Import the User interface

// Define the shape of the context value
interface AuthContextType {
  user: User | null; // Use the User type for user state
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null; // Error state to show any errors
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password1: string, password2: string, user_type: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateUser: (id: string, data: FormData) => Promise<void>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider component to wrap around your app
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null); // User state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false); // Loading state
  const [error, setError] = useState<string | null>(null); // Error state

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true); // Set loading to true during the check
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
          const user = await authManager.getUser(); // Fetch the user data
          setUser(user);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        setIsAuthenticated(false);
        console.error('Error checking authentication status:', err);
      } finally {
        setLoading(false); // Set loading to false after the check completes
      }
    };

    checkAuth();
  }, []);

  // Login method
  const login = async (email: string, password: string) => {
    setLoading(true); // Set loading to true during login
    setError(null); // Reset error state
    try {
      const response = await authManager.login(email, password);
      if (response) {
        setIsAuthenticated(true);
        const user = await authManager.getUser();
        setUser(user);
      }
    } catch (err) {
      setError('Login failed, please try again.');
      console.error('Login failed', err);
    } finally {
      setLoading(false); // Set loading to false after login attempt
    }
  };

  // Register method
  const register = async (email: string, password1: string, password2: string, user_type: string) => {
    setLoading(true); // Set loading to true during registration
    setError(null); // Reset error state
    try {
      const response = await authManager.register(email, password1, password2, user_type);
      if (response) {
        setIsAuthenticated(true);
        const user = await authManager.getUser();
        setUser(user);
      }
    } catch (err) {
      setError('Registration failed, please try again.');
      console.error('Registration failed', err);
    } finally {
      setLoading(false); // Set loading to false after registration attempt
    }
  };

  // Logout method
  const logout = async () => {
    setLoading(true); // Set loading to true during logout
    setError(null); // Reset error state
    try {
      await authManager.logout();
      setUser(null);
      setIsAuthenticated(false);
    } catch (err) {
      setError('Logout failed, please try again.');
      console.error('Logout failed', err);
    } finally {
      setLoading(false); // Set loading to false after logout attempt
    }
  };

  // Refresh token method
  const refreshToken = async () => {
    setLoading(true); // Set loading to true during token refresh
    setError(null); // Reset error state
    try {
      await authManager.refreshToken();
    } catch (err) {
      setError('Token refresh failed, please try again.');
      console.error('Token refresh failed', err);
    } finally {
      setLoading(false); // Set loading to false after refresh attempt
    }
  };

  // Update user data method
  const updateUser = async (id: string, data: FormData) => {
    setLoading(true); // Set loading to true during update
    setError(null); // Reset error state
    try {
      const updatedUser = await authManager.updateUser(id, data);
      setUser(updatedUser);
    } catch (err) {
      setError('Failed to update user data, please try again.');
      console.error('Failed to update user data', err);
    } finally {
      setLoading(false); // Set loading to false after update attempt
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        error,
        login,
        register,
        logout,
        refreshToken,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to access the AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
