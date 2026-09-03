import { createContext, useContext, ReactNode } from "react";
import { useAuth, useUser } from "@clerk/react";

type ClerkUser = ReturnType<typeof useUser>["user"];

// Clerk's hooks (useAuth, useUser, etc.) throw synchronously if called
// without a <ClerkProvider> ancestor — and the app runs without Clerk at
// all when VITE_CLERK_PUBLISHABLE_KEY isn't configured. Components that are
// always mounted (like PlayerProvider and FullPlayer) must never call
// Clerk's hooks directly, or the whole app crashes to a blank screen the
// moment Clerk isn't set up. Everything reads auth state through
// useOptionalAuth() instead, which is always safe to call.

interface OptionalAuth {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null | undefined;
  user: ClerkUser;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const fallbackAuth: OptionalAuth = {
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  user: null,
  getToken: async () => null,
  signOut: async () => {},
};

const AuthContext = createContext<OptionalAuth>(fallbackAuth);

export function useOptionalAuth(): OptionalAuth {
  return useContext(AuthContext);
}

// Only ever rendered inside <ClerkProvider> (see App.tsx) — safe to call
// Clerk's real hooks here.
export function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useAuth();
  const { user } = useUser();

  return (
    <AuthContext.Provider
      value={{
        isLoaded,
        isSignedIn: Boolean(isSignedIn),
        userId,
        user,
        getToken: async () => (await getToken()) ?? null,
        signOut: async () => {
          await signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
