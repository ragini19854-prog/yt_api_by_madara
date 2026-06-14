import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { PlayerProvider } from "./contexts/PlayerContext";
import { Sidebar } from "./components/layout/Sidebar";
import { MiniPlayer } from "./components/player/MiniPlayer";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "./pages/home";
import Search from "./pages/search";
import Library from "./pages/library";
import PlaylistDetail from "./pages/playlist";
import Profile from "./pages/profile";
import Settings from "./pages/settings";
import BotPage from "./pages/bot";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(350, 89%, 60%)",
    colorForeground: "hsl(0, 0%, 98%)",
    colorMutedForeground: "hsl(240, 5%, 64%)",
    colorDanger: "hsl(0, 62%, 60%)",
    colorBackground: "hsl(240, 10%, 4%)",
    colorInput: "hsl(240, 8%, 12%)",
    colorInputForeground: "hsl(0, 0%, 98%)",
    colorNeutral: "hsl(240, 5%, 26%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-[hsl(240,10%,8%)] rounded-2xl w-[440px] max-w-full overflow-hidden border border-white/10",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-semibold",
    headerSubtitle: "text-white/60",
    socialButtonsBlockButtonText: "text-white/80",
    formFieldLabel: "text-white/70 text-sm",
    footerActionLink:
      "text-[hsl(350,89%,60%)] hover:text-[hsl(350,89%,70%)]",
    footerActionText: "text-white/50",
    dividerText: "text-white/40",
    identityPreviewEditButton: "text-[hsl(350,89%,60%)]",
    formFieldSuccessText: "text-green-400",
    alertText: "text-white/80",
    logoBox: "mb-2",
    logoImage: "h-8 w-auto",
    socialButtonsBlockButton:
      "border border-white/10 bg-white/5 hover:bg-white/10 text-white",
    formButtonPrimary:
      "bg-[hsl(350,89%,60%)] hover:bg-[hsl(350,89%,70%)] text-white font-medium",
    formFieldInput:
      "bg-[hsl(240,8%,12%)] border-white/10 text-white placeholder:text-white/30",
    footerAction: "border-t border-white/10",
    dividerLine: "bg-white/10",
    alert: "border border-white/10 bg-white/5",
    otpCodeFieldInput: "bg-[hsl(240,8%,12%)] border-white/10 text-white",
    formFieldRow: "",
    main: "gap-4",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }: { user?: { id?: string } | null }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        <div className="min-h-full pb-24 md:pb-28">{children}</div>
      </main>
      <MiniPlayer />
    </div>
  );
}

function AppRouter() {
  return (
    <PlayerProvider>
      <Layout>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/search" component={Search} />
          <Route path="/library" component={Library} />
          <Route path="/playlist/:id" component={PlaylistDetail} />
          <Route path="/profile" component={Profile} />
          <Route path="/settings" component={Settings} />
          <Route path="/bot" component={BotPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </PlayerProvider>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Get started with Madara Music",
          },
        },
      }}
      routerPush={(to: string) => setLocation(stripBase(to))}
      routerReplace={(to: string) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <Switch>
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route>
              <AppRouter />
            </Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
