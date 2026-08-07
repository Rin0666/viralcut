import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { SiGoogle } from "react-icons/si";

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();

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
