// lib/auth.ts
export const getAuthToken = () => localStorage.getItem('auth_token');

export const setAuthSession = (token: string, username: string) => {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('username', username);
};

export const clearAuthSession = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('username');
};
