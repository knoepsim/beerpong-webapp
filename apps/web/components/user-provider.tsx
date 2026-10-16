"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@/types";
import { api, NetworkError } from "@/lib/api";

interface UserContextValue {
  user: User | null;
  isLoading: boolean;
  reload: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: true,
  reload: async () => {},
});

export function useCurrentUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      setUser(await api.users.me({ guest: true }));
    } catch (error) {
      // Nobody is logged in: say so. A network problem says nothing about that: keep what is known.
      if (!(error instanceof NetworkError)) setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // after a network problem, ask again as soon as the browser is back online
    const reload = () => void load();
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, reload: load }}>
      {children}
    </UserContext.Provider>
  );
}
