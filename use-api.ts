import { useMutation } from '@tanstack/react-query';
import { getAuthToken, setAuthSession } from '@/lib/auth';

export class ApiError extends Error {
  constructor(public message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// Helper ส่ง HTTP request พร้อม JWT header อัตโนมัติ
async function fetchApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      errorMessage = await response.text() || errorMessage;
    }
    throw new ApiError(errorMessage, response.status);
  }
  return response.json();
}

export function useLogin() {
  return useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const response = await fetchApi<{ token: string; username: string }>('/api/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setAuthSession(response.token, response.username);
      return response;
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const response = await fetchApi<{ token: string; username: string }>('/api/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setAuthSession(response.token, response.username);
      return response;
    },
  });
}

export function useSummarize() {
  return useMutation({
    mutationFn: async (data: { text: string }) => {
      return fetchApi<{
        summary: string;
        keyPoints: string[];
        actionItems: string[];
      }>('/api/summarize', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  });
}
