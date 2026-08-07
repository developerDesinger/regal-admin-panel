import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';
import './index.css';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Admin data is operational, not real-time: a short stale window keeps
      // navigation instant without serving numbers that are visibly wrong.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const code = (error as ApiError)?.code;
        // Retrying an auth or permission failure just burns requests and can
        // trip the login rate limiter.
        if (
          code === 'UNAUTHENTICATED' ||
          code === 'INSUFFICIENT_PERMISSION' ||
          code === 'NOT_FOUND' ||
          code === 'VALIDATION_FAILED' ||
          code === 'RATE_LIMITED'
        ) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
