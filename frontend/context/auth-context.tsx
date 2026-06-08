"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import api from '../lib/axios';

interface User {
  id: string;
  name: string;
  email: string;
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  exp: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    // Check if token exists in localStorage on mount
    const storedToken = localStorage.getItem('collab_notes_token');
    if (storedToken) {
      try {
        const decoded = jwtDecode<DecodedToken>(storedToken);
        // Verify expiration
        const currentTime = Date.now() / 1000;
        if (decoded.exp > currentTime) {
          setToken(storedToken);
          setUser({
            id: decoded.sub,
            name: decoded.name,
            email: decoded.email,
          });
        } else {
          // Token expired, clear it
          handleClearAuth();
        }
      } catch (error) {
        console.error('Failed to decode token:', error);
        handleClearAuth();
      }
    }
    setIsLoading(false);
  }, []);

  const handleSetAuth = (accessToken: string, loggedInUser: User) => {
    setToken(accessToken);
    setUser(loggedInUser);
    localStorage.setItem('collab_notes_token', accessToken);
    // Set non-httpOnly cookie for next.js middleware server-side reading
    document.cookie = `collab_notes_token=${accessToken}; path=/; SameSite=Lax`;
  };

  const handleClearAuth = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('collab_notes_token');
    // Clear cookie
    document.cookie = 'collab_notes_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax';
  };

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { access_token, user: loggedInUser } = response.data;
    handleSetAuth(access_token, loggedInUser);
    window.location.replace('/dashboard');
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await api.post('/auth/register', { name, email, password });
    const { access_token, user: loggedInUser } = response.data;
    handleSetAuth(access_token, loggedInUser);
    window.location.replace('/dashboard');
  };

  const logout = () => {
    handleClearAuth();
    window.location.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
