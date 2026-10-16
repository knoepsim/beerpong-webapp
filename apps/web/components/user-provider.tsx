"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@/types";
import { api } from "@/lib/api";

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
      const u = await api.users.me({ guest: true });
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, reload: load }}>
      {children}
    </UserContext.Provider>
  );
}
