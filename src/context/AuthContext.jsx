import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('kings_token');
    const storedUser = localStorage.getItem('kings_user');
    if (token) {
      setIsAuthenticated(true);
      setUser(storedUser ? JSON.parse(storedUser) : { name: "Proprietário KING'S" });
    }
    setLoading(false);
  }, []);

  const login = async (pin) => {
    const res = await api.login(pin);
    if (res.success) {
      localStorage.setItem('kings_token', res.token);
      localStorage.setItem('kings_user', JSON.stringify(res.user));
      setIsAuthenticated(true);
      setUser(res.user);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('kings_token');
    localStorage.removeItem('kings_user');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
