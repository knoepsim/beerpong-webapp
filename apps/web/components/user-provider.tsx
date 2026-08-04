"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@/types";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

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
    if (!getAccessToken()) {
      setIsLoading(false);
      return;
    }
    try {
      const u = await api.users.me();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, reload: load }}>
      {children}
    </UserContext.Provider>
  );
}
