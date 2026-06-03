"use client";

import React from 'react';
import { useAuth } from '@/context/auth-context';
import { FullScreenLoader } from '@/components/ui/full-screen-loader';

export const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return <>{children}</>;
};

export default AuthWrapper;
