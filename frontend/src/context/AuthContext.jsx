import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
          const res = await fetch(`${API_URL}/users/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const profile = await res.json();
            setUser({
              id: profile.id,
              username: profile.username,
              email: profile.email,
              role: profile.role,
              token
            });
          } else {
            localStorage.removeItem('token');
            setUser(null);
          }
        } catch (e) {
          console.error("Failed to load user profile", e);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (username, password) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Invalid credentials' }));
        throw new Error(err.message || 'Login failed');
      }

      const data = await res.json();
      localStorage.setItem('token', data.token);
      setUser({
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role,
        token: data.token
      });
      return data;
    } catch (err) {
      const fetchFailed = err instanceof TypeError ||
        (err && err.message && typeof err.message === 'string' && err.message.toLowerCase().includes('failed to fetch'));
      const message = fetchFailed
        ? 'Unable to connect to the backend server. Ensure the backend is running and reachable.'
        : err.message || 'Login failed. Please check your credentials.';
      throw new Error(message);
    }
  };

  const register = async (username, email, password, role) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password, role })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Registration failed' }));
        throw new Error(err.message || 'Registration failed');
      }

      const data = await res.json();
      localStorage.setItem('token', data.token);
      setUser({
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role,
        token: data.token
      });
      return data;
    } catch (err) {
      const fetchFailed = err instanceof TypeError ||
        (err && err.message && typeof err.message === 'string' && err.message.toLowerCase().includes('failed to fetch'));
      const message = fetchFailed
        ? 'Unable to connect to the backend server. Ensure the backend is running and reachable.'
        : err.message || 'Registration failed. Please check your information.';
      throw new Error(message);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
