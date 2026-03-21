// เก็บ JWT token และ username ใน localStorage
export const getAuthToken = () => localStorage.getItem('auth_token');
export const getAuthUsername = () => localStorage.getItem('auth_username');

export const setAuthSession = (token: string, username: string) => {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_username', username);
};

export const clearAuthSession = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_username');
};

export const isAuthenticated = () => !!getAuthToken();
