// AppProviders.tsx

import React, { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/services/queryClient';

import { FeedbackProvider } from './components/feedback';
import { AuthProvider } from './contexts/AuthContext';
import { EventsProvider } from './contexts/EventsContext';
import { ModalProvider } from './contexts/ModalContext';
import { ThemeProvider } from './contexts/ThemeContext';

/** Wraps the app in context providers only. */
const AppProviders: React.FC<{ children: ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <FeedbackProvider>
      <AuthProvider>
        <EventsProvider>
          <ThemeProvider>
            <ModalProvider>{children}</ModalProvider>
          </ThemeProvider>
        </EventsProvider>
      </AuthProvider>
    </FeedbackProvider>
  </QueryClientProvider>
);

export default AppProviders;
