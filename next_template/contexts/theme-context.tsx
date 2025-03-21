'use client';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Define the shape of the theme context value
interface ThemeContextType {
  theme: 'light' | 'dark'; // Either light or dark
  toggleTheme: () => void; // Method to toggle the theme
}

// Create the theme context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ThemeProvider component to wrap around the app
interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Get the theme from localStorage or default to light
  const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
  const initialTheme: 'light' | 'dark' = storedTheme === 'dark' ? 'dark' : 'light';

  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);

  // Update the class on the <html> element based on the current theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  // Function to toggle between light and dark themes
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to access the ThemeContext
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
