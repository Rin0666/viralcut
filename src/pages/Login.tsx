import { useAuth } from "../contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { SiGoogle } from "react-icons/si";
import { useState } from "react";
import { Link } from "lucide-react";

export default function Login() {
  const { user, loading, signInWithGoogle, enterGuestMode } = useAuth();
  const navigate = useNavigate();

  const [guestUrl, setGuestUrl] = useState("");
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-foreground/60 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGuestSubmit = async () => {
    setGuestError(null);
    if (!guestUrl.trim()) {
      setGuestError("Please paste a YouTube video or channel link.");
      return;
    }

    setGuestLoading(true);
    try {
      const parsed = enterGuestMode(guestUrl.trim());
      if (!parsed) {
        setGuestError(
          "Couldn't recognize that link. Try a YouTube video URL (youtube.com/watch?v=...) or channel link.",
        );
        setGuestLoading(false);
        return;
      }

      if (parsed.type === "video") {
        navigate(`/analyze/${parsed.id}?guest=1`);
      } else {
        // channel or handle — need to resolve handle to channel ID
        navigate(`/dashboard?guest=1&${parsed.type === "channel" ? `channel=${parsed.id}` : `handle=${parsed.handle}`}`);
      }
    } catch {
      setGuestError("Something went wrong. Try again.");
    } finally {
      setGuestLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleGuestSubmit();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-heading font-bold text-foreground tracking-tight">
            Viral<span className="text-primary">Cut</span>
          </h1>
          <p className="mt-3 text-foreground/60 text-sm max-w-xs mx-auto leading-relaxed">
            Turn your long-form YouTube videos into viral short clips — powered by AI.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-muted border border-border rounded-2xl p-8 shadow-lg">
          <h2 className="text-xl font-semibold text-foreground text-center mb-2">
            Get Started
          </h2>
          <p className="text-foreground/50 text-sm text-center mb-8">
            Connect your YouTube channel to begin
          </p>

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-medium py-3 px-6 rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <SiGoogle className="w-5 h-5" />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-muted px-3 text-foreground/40">or continue as guest</span>
            </div>
          </div>

          {/* Guest mode */}
          <div className="space-y-3">
            <label htmlFor="guest-url" className="block text-sm text-foreground/60">
              Paste a YouTube video or channel link
            </label>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
              <input
                id="guest-url"
                type="url"
                placeholder="https://youtube.com/watch?v=... or @channel"
                value={guestUrl}
                onChange={(e) => {
                  setGuestUrl(e.target.value);
                  if (guestError) setGuestError(null);
                }}
                onKeyDown={handleKeyDown}
                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-foreground/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent transition-all duration-150 outline-none"
                disabled={guestLoading}
              />
            </div>
            {guestError && (
              <p className="text-destructive text-xs">{guestError}</p>
            )}
            <button
              onClick={handleGuestSubmit}
              disabled={guestLoading}
              className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium py-3 px-6 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {guestLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Continue as Guest"
              )}
            </button>
          </div>

          <p className="mt-6 text-foreground/40 text-xs text-center leading-relaxed">
            By continuing, you grant ViralCut permission to view your YouTube channel
            data and upload Shorts on your behalf. We never store your videos — all
            clipping happens locally in your browser.
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-foreground/30 text-xs text-center">
          &copy; {new Date().getFullYear()} ViralCut. All rights reserved.
        </p>
      </div>
    </div>
  );
}
