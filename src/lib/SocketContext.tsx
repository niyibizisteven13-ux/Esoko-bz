import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAuthToken } from '../services/apiClient';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io(undefined, {
      path: '/socket.io',
      withCredentials: true,
      auth: {
        token: getAuthToken(),
      },
      autoConnect: true,
    });

    setSocket(s);

    const handleAuthChanged = () => {
      s.auth = { token: getAuthToken() };
      if (getAuthToken()) {
        if (!s.connected) s.connect();
      } else {
        s.disconnect();
      }
    };
    window.addEventListener('auth:changed', handleAuthChanged);

    return () => {
      window.removeEventListener('auth:changed', handleAuthChanged);
      try {
        s.disconnect();
      } catch (e) {
        // ignore
      }
      setSocket(null);
    };
  }, []);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

export default SocketContext;
