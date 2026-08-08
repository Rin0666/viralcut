import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams, Navigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getMyChannel,
  getTopVideos,
  getPublicChannelById,
  getPublicChannelByHandle,
  getPublicTopVideos,
  type YouTubeChannel,
  type YouTubeVideo,
} from "../lib/youtube";
import {
  Eye,
  Heart,
  MessageCircle,
  Play,
  Calendar,
  ArrowUpDown,
  LogOut,
  RefreshCw,
  Home,
  User,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

/** Convert ISO 8601 duration (e.g. PT4M13S) to mm:ss or h:mm:ss */
function formatDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "";
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const sec = parseInt(m[3] ?? "0", 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(min)}:${pad(sec)}`;
  return `${min}:${pad(sec)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

type SortKey = "views" | "likes" | "comments" | "date";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "views", label: "Most Viewed" },
  { value: "likes", label: "Most Liked" },
  { value: "comments", label: "Most Comments" },
  { value: "date", label: "Newest" },
];

function sortVideos(videos: YouTubeVideo[], key: SortKey): YouTubeVideo[] {
  const sorted = [...videos];
  switch (key) {
    case "views":
      sorted.sort((a, b) => b.viewCount - a.viewCount);
      break;
    case "likes":
      sorted.sort((a, b) => b.likeCount - a.likeCount);
      break;
    case "comments":
      sorted.sort((a, b) => b.commentCount - a.commentCount);
      break;
    case "date":
      sorted.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() -
          new Date(a.publishedAt).getTime(),
      );
      break;
  }
  return sorted;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="bg-muted border border-border rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-video bg-border/50" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-border/50 rounded w-3/4" />
        <div className="h-4 bg-border/50 rounded w-1/2" />
        <div className="flex gap-4">
          <div className="h-3 bg-border/50 rounded w-16" />
          <div className="h-3 bg-border/50 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { user, loading: authLoading, signOut, googleAccessToken, clearGuestMode } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isGuest = searchParams.get("guest") === "1" && !user;
  const channelId = searchParams.get("channel");
  const handle = searchParams.get("handle");

  const [channel, setChannel] = useState<YouTubeChannel | null>(null);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("views");

  const sortedVideos = useMemo(() => sortVideos(videos, sort), [videos, sort]);

  useEffect(() => {
    let cancelled = false;

    async function loadAuth() {
      if (!googleAccessToken) return;
      setLoading(true);
      setError(null);
      try {
        const ch = await getMyChannel(googleAccessToken!);
        if (cancelled) return;
        setChannel(ch);
        const vids = await getTopVideos(googleAccessToken!, ch.uploadsPlaylistId);
        if (cancelled) return;
        setVideos(vids);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadGuest() {
      if (!isGuest) return;
      setLoading(true);
      setError(null);
      try {
        let ch: YouTubeChannel | null = null;

        if (channelId) {
          ch = await getPublicChannelById(channelId);
        } else if (handle) {
          ch = await getPublicChannelByHandle(handle);
        }

        if (cancelled) return;

        if (!ch) {
          setError("Couldn't find that YouTube channel. Check the link and try again.");
          setLoading(false);
          return;
        }

        setChannel(ch);
        const vids = await getPublicTopVideos(ch.uploadsPlaylistId);
        if (cancelled) return;
        setVideos(vids);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (isGuest) {
      loadGuest();
    } else {
      loadAuth();
    }

    return () => {
      cancelled = true;
    };
  }, [googleAccessToken, isGuest, channelId, handle]);

  // Auth guards
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-foreground/60 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return <Navigate to="/" replace />;
  }

  const handleExitGuest = () => {
    clearGuestMode();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={isGuest ? "/" : "/dashboard"}
              className="text-xl font-heading font-bold text-foreground tracking-tight"
            >
              Viral<span className="text-primary">Cut</span>
            </Link>
            {isGuest && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full border border-primary/20">
                <User className="w-3 h-3" />
                Guest
              </span>
            )}
          </div>
          {isGuest ? (
            <button
              onClick={handleExitGuest}
              className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors duration-150 cursor-pointer text-sm"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </button>
          ) : (
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors duration-150 cursor-pointer text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Error state ── */}
        {error && (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 max-w-md text-center">
              <p className="text-destructive font-medium mb-1">
                Couldn&apos;t load channel
              </p>
              <p className="text-foreground/60 text-sm mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ── Loading state ── */}
        {loading && !error && (
          <>
            <div className="flex items-center gap-4 mb-8 animate-pulse">
              <div className="w-16 h-16 rounded-full bg-border/50" />
              <div className="space-y-2">
                <div className="h-5 bg-border/50 rounded w-48" />
                <div className="h-4 bg-border/50 rounded w-32" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </>
        )}

        {/* ── Loaded state ── */}
        {!loading && !error && (
          <>
            {/* Channel info */}
            {channel && (
              <div className="flex items-center gap-4 mb-8">
                {channel.thumbnail && (
                  <img
                    src={channel.thumbnail}
                    alt={channel.title}
                    className="w-16 h-16 rounded-full border-2 border-primary/30"
                  />
                )}
                <div>
                  <h2 className="text-2xl font-heading font-semibold text-foreground">
                    {channel.title}
                  </h2>
                  <p className="text-foreground/50 text-sm">
                    {formatCount(channel.subscriberCount)} subscribers
                    {" · "}
                    {channel.videoCount.toLocaleString()} videos
                  </p>
                </div>
              </div>
            )}

            {/* Sort bar */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-foreground/60 text-sm">
                {videos.length === 0
                  ? "No videos yet"
                  : `${videos.length} video${videos.length === 1 ? "" : "s"}`}
              </p>
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="appearance-none bg-muted border border-border rounded-lg pl-3 pr-9 py-2 text-sm text-foreground cursor-pointer focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-150"
                  aria-label="Sort videos"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
              </div>
            </div>

            {/* Video grid / empty */}
            {sortedVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Play className="w-12 h-12 text-foreground/20 mb-4" />
                <p className="text-foreground/50 text-lg font-medium">
                  No videos found
                </p>
                <p className="text-foreground/30 text-sm mt-1 max-w-sm">
                  {isGuest
                    ? "This channel hasn't uploaded any videos yet."
                    : "Once you upload videos to your YouTube channel, they'll appear here ready for clipping."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {sortedVideos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => navigate(`/analyze/${video.id}${isGuest ? "?guest=1" : ""}`)}
                    className="group bg-muted border border-border rounded-xl overflow-hidden text-left hover:border-primary/30 hover:-translate-y-1 transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-black/40 overflow-hidden">
                      {video.thumbnail ? (
                        <img
                          src={video.thumbnail}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-10 h-10 text-foreground/20" />
                        </div>
                      )}
                      {/* Duration badge */}
                      {video.duration && (
                        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded">
                          {formatDuration(video.duration)}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 space-y-2">
                      <h3 className="text-foreground font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-150">
                        {video.title}
                      </h3>
                      <div className="flex items-center gap-4 text-foreground/40 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {formatCount(video.viewCount)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5" />
                          {formatCount(video.likeCount)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5" />
                          {formatCount(video.commentCount)}
                        </span>
                        <span className="inline-flex items-center gap-1 ml-auto">
                          <Calendar className="w-3.5 h-3.5" />
                          {timeAgo(video.publishedAt)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}