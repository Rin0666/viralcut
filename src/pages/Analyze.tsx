import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, Home, User, Play } from "lucide-react";
import { getPublicVideoById, type YouTubeVideo } from "../lib/youtube";

export default function Analyze() {
  const { videoId } = useParams<{ videoId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isGuest = searchParams.get("guest") === "1" && !user;

  const [video, setVideo] = useState<YouTubeVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId || !isGuest) return;

    let cancelled = false;

    async function load() {
      setVideoLoading(true);
      setVideoError(null);
      try {
        const v = await getPublicVideoById(videoId!);
        if (cancelled) return;
        if (!v) {
          setVideoError("Couldn't find that video. Check the link and try again.");
          return;
        }
        setVideo(v);
      } catch (err) {
        if (!cancelled) {
          setVideoError(err instanceof Error ? err.message : "Something went wrong.");
        }
      } finally {
        if (!cancelled) setVideoLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [videoId, isGuest]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && !isGuest) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(isGuest ? "/" : "/dashboard")}
              className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors duration-150 cursor-pointer text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              {isGuest ? "Back to Home" : "Back to Dashboard"}
            </button>
            {isGuest && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full border border-primary/20">
                <User className="w-3 h-3" />
                Guest
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Video info (guest mode) */}
        {isGuest && videoLoading && (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-foreground/60 text-sm">Loading video info...</p>
          </div>
        )}

        {isGuest && videoError && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-destructive font-medium mb-2">Couldn't load video</p>
            <p className="text-foreground/60 text-sm mb-4">{videoError}</p>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 active:scale-[0.98] transition-all duration-150 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </button>
          </div>
        )}

        {isGuest && video && !videoLoading && !videoError && (
          <div className="bg-muted border border-border rounded-xl overflow-hidden mb-8">
            <div className="flex flex-col sm:flex-row">
              {video.thumbnail && (
                <div className="sm:w-80 shrink-0">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full aspect-video sm:aspect-auto sm:h-full object-cover"
                  />
                </div>
              )}
              <div className="p-5 flex flex-col justify-center">
                <h2 className="text-lg font-semibold text-foreground mb-2 line-clamp-2">
                  {video.title}
                </h2>
                <p className="text-foreground/50 text-sm line-clamp-2 mb-3">
                  {video.description || "No description"}
                </p>
                <div className="flex items-center gap-4 text-foreground/40 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Play className="w-3.5 h-3.5" />
                    {video.viewCount.toLocaleString()} views
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder for the analysis UI (same for auth and guest) */}
        <div className="text-center py-20">
          <p className="text-foreground/40 text-lg">
            AI analysis for video <span className="text-foreground/60 font-mono">{videoId}</span> — coming soon
          </p>
        </div>
      </main>
    </div>
  );
}