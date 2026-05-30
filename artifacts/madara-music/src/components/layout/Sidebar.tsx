import { Link, useLocation } from "wouter";
import { Home, Search, Library, User, Settings, Download, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, SignInButton, UserButton } from "@clerk/react";

export function Sidebar() {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();

  const links = [
    { href: "/", label: "Home", icon: Home },
    { href: "/search", label: "Search", icon: Search },
    { href: "/library", label: "Library", icon: Library },
  ];

  const bottomLinks = [
    { href: "/downloads", label: "Downloads", icon: Download },
    { href: "/profile", label: "Profile", icon: User },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="hidden md:flex flex-col w-64 bg-background/50 backdrop-blur-xl border-r border-border p-4 h-full">
      <div className="flex items-center gap-2 px-2 mb-8">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <Music className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">MADARA</span>
      </div>

      <nav className="flex-1 space-y-1">
        <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Menu</div>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location === link.href;
          return (
            <Link key={link.href} href={link.href} className="block">
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 mt-auto">
        <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">General</div>
        {bottomLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location === link.href;
          return (
            <Link key={link.href} href={link.href} className="block">
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 px-3">
        {isSignedIn ? (
          <div className="flex items-center gap-3">
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
            <span className="text-sm font-medium">Account</span>
          </div>
        ) : (
          <SignInButton mode="modal">
            <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2 rounded-md transition-colors">
              Sign In
            </button>
          </SignInButton>
        )}
      </div>
    </div>
  );
}
