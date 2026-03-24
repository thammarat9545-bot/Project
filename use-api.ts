import { useMutation, useQuery } from '@tanstack/react-query';
import { getAuthToken, setAuthSession, clearAuthSession } from './auth';

// 1. Custom Error Class สำหรับจัดการ Error จาก API
export class ApiError extends Error {
  constructor(public message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// 2. Helper สำหรับยิง Fetch ที่แนบ JWT Token อัตโนมัติ
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    // ถ้า Token หมดอายุ (401) ให้เด้งไปหน้า Login
    if (response.status === 401) {
      clearAuthSession();
      window.location.href = '/';
    }
    throw new ApiError(data.error || 'Something went wrong', response.status);
  }

  return data;
}

// --- Mutations & Queries ---

/**
 * Hook สำหรับ Login (ใช้ที่หน้า Sign In)
 */
export const useLogin = () => {
  return useMutation({
    mutationFn: async (credentials: { username: string; password: any }) => {
      return apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
    },
    onSuccess: (data) => {
      // เก็บ Token และ Username ลง LocalStorage
      setAuthSession(data.token, data.username);
      // เปลี่ยนหน้าไป Dashboard
      window.location.href = '/dashboard'; 
    },
  });
};

/**
 * Hook สำหรับสมัครสมาชิก (Register)
 */
export const useRegister = () => {
  return useMutation({
    mutationFn: async (userData: { username: string; password: any }) => {
      return apiFetch('/api/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
    },
    onSuccess: (data) => {
      setAuthSession(data.token, data.username);
      window.location.href = '/dashboard';
    },
  });
};

/**
 * Hook สำหรับปุ่ม "สรุปประชุม" (Summarize)
 * ส่ง transcript ไปหา AI และรับผลสรุปกลับมา
 */
export const useSummarize = () => {
  return useMutation({
    mutationFn: async (content: string) => {
      return apiFetch('/api/summarize', {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },
  });
};

/**
 * Hook สำหรับดึงข้อมูล Profile หรือตรวจสอบสถานะ Login
 */
export const useUserStatus = () => {
  return useQuery({
    queryKey: ['user-status'],
    queryFn: () => apiFetch('/api/me'),
    retry: false,
  });
};
