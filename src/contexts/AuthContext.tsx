import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import { parseYouTubeUrl, type YouTubeLinkType } from "../lib/youtube";

interface GuestState {
  /** "video" or "channel" depending on the parsed URL */
  type: "video" | "channel" | "handle";
  /** The video ID or channel ID (handle is resolved later) */
  id: string;
  /** Original raw URL the guest entered */
  rawUrl: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  googleAccessToken: string | null;
  /** Guest mode — user is browsing without a Google account */
  guest: GuestState | null;
  enterGuestMode: (url: string) => YouTubeLinkType;
  clearGuestMode: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
].join(" ");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState<GuestState | null>(() => {
    // Restore guest session from sessionStorage
    const stored = sessionStorage.getItem("viralcut_guest");
    if (stored) {
      try {
        return JSON.parse(stored) as GuestState;
      } catch {
        sessionStorage.removeItem("viralcut_guest");
      }
    }
    return null;
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: YOUTUBE_SCOPES,
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const googleAccessToken = session?.provider_token ?? null;

  const enterGuestMode = useCallback((url: string): YouTubeLinkType => {
    const parsed = parseYouTubeUrl(url);
    if (!parsed) return null;

    const guestState: GuestState = {
      type: parsed.type,
      id: parsed.type === "handle" ? parsed.handle : parsed.id,
      rawUrl: url,
    };

    setGuest(guestState);
    sessionStorage.setItem("viralcut_guest", JSON.stringify(guestState));
    return parsed;
  }, []);

  const clearGuestMode = useCallback(() => {
    setGuest(null);
    sessionStorage.removeItem("viralcut_guest");
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signInWithGoogle, signOut, googleAccessToken, guest, enterGuestMode, clearGuestMode }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
