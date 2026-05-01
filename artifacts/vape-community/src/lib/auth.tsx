import {
  createContext,
  useContext,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  useAuth as useClerkAuth,
  useClerk,
} from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, "");

export type AppUser = {
  id: number;
  clerkId: string | null;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  isAdmin: boolean;
  isAiPersona: boolean;
  postCount: number;
  joinedAt: string;
  emailVerified: boolean;
  themePreference: string | null;
  notificationsEnabled: boolean;
};

interface AuthContextType {
  user: AppUser | null;
  isLoaded: boolean;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function CurrentUserLoader({ children }: { children: ReactNode }) {
  const { isLoaded: clerkLoaded, isSignedIn, userId, getToken } = useClerkAuth();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // Register Clerk token getter globally so ALL API client calls (including
  // useCreateOrder, useCreatePost, etc.) automatically include the bearer token.
  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? getToken : null);
    return () => { setAuthTokenGetter(null); };
  }, [isSignedIn, getToken]);

  useEffect(() => {
    const uid = isSignedIn ? (userId ?? null) : null;
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== uid) {
      queryClient.removeQueries({ queryKey: ["current-user"] });
    }
    prevUserIdRef.current = uid;
  }, [isSignedIn, userId, queryClient]);

  const { data: dbUser, isLoading } = useQuery<AppUser | null>({
    queryKey: ["current-user", userId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return null;
      const r = await fetch(`${BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null;
      return r.json() as Promise<AppUser>;
    },
    enabled: !!isSignedIn,
    staleTime: 60_000,
  });

  const user: AppUser | null = isSignedIn && dbUser ? dbUser : null;
  // Only report loaded once Clerk has resolved its session AND, if signed in,
  // the user profile fetch is also complete. This prevents a flash of "logged
  // out" state while Clerk is restoring an existing session after a page refresh.
  const isLoaded = clerkLoaded && (!isSignedIn || !isLoading);

  const logout = async () => {
    await signOut();
    queryClient.removeQueries({ queryKey: ["current-user"] });
  };

  return (
    <AuthContext.Provider value={{ user, isLoaded, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <CurrentUserLoader>{children}</CurrentUserLoader>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
