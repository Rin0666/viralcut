import { useState, useRef, useCallback } from "react";
import { Scissors, Upload, Download, Sparkles, FileVideo, AlertCircle, CheckCircle2, Film } from "lucide-react";
import { SiYoutube } from "react-icons/si";
import { parseYouTubeUrl } from "../lib/youtube";
import { supabaseUrl } from "../lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClipSuggestion {
  start: number;
  end: number;
  title: string;
  reason: string;
}

type Step = "url" | "analyzing" | "results" | "clipping" | "done";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ---------------------------------------------------------------------------
// Edge Function URL
// ---------------------------------------------------------------------------

const EDGE_FUNCTION_URL = `${supabaseUrl}/functions/v1/analyze-video`;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [clips, setClips] = useState<ClipSuggestion[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [clippedBlobs, setClippedBlobs] = useState<Map<number, Blob>>(new Map());
  const [clippingIndex, setClippingIndex] = useState(-1);
  const [clipProgress, setClipProgress] = useState(0);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -----------------------------------------------------------------------
  // Step 1 — Submit URL
  // -----------------------------------------------------------------------

  const handleSubmitUrl = async () => {
    setError(null);

    if (!url.trim()) {
      setError("Paste a YouTube video link first.");
      return;
    }

    const parsed = parseYouTubeUrl(url.trim());
    if (!parsed || parsed.type !== "video") {
      setError("Please paste a valid YouTube video URL (e.g. youtube.com/watch?v=...).");
      return;
    }

    setVideoId(parsed.id);
    setStep("analyzing");

    try {
      // Show a nice loading state for at least 1.5s so it feels substantial
      const startTime = Date.now();

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: `https://www.youtube.com/watch?v=${parsed.id}` }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `Analysis failed (${response.status})`);
      }

      const data = await response.json();

      // Ensure minimum loading time
      const elapsed = Date.now() - startTime;
      if (elapsed < 1500) {
        await new Promise((r) => setTimeout(r, 1500 - elapsed));
      }

      setClips(data.clips ?? []);
      if (data.clips?.length === 0) {
        setError("AI couldn't find any clip-worthy moments in this video. Try another video.");
        setStep("url");
        return;
      }

      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setStep("url");
    }
  };

  // -----------------------------------------------------------------------
  // Step 2 — File upload
  // -----------------------------------------------------------------------

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      setVideoFile(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // -----------------------------------------------------------------------
  // Step 3 — Clip with ffmpeg.wasm
  // -----------------------------------------------------------------------

  const loadFfmpeg = useCallback(async () => {
    if (ffmpegLoaded) return;
    setFfmpegLoading(true);
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();

      ffmpeg.on("progress", ({ progress }) => {
        setClipProgress(Math.round(progress * 100));
      });

      await ffmpeg.load();
      // Store on window so we can access it from the clip handler
      (window as any).__ffmpeg = ffmpeg;
      (window as any).__fetchFile = fetchFile;
      setFfmpegLoaded(true);
    } catch (err) {
      throw new Error("Failed to load video processing engine. Try a different browser.");
    } finally {
      setFfmpegLoading(false);
    }
  }, [ffmpegLoaded]);

  const handleClipAll = async () => {
    if (!videoFile || !videoId) return;

    setStep("clipping");
    setClipProgress(0);

    try {
      await loadFfmpeg();
      const ffmpeg = (window as any).__ffmpeg;
      const fetchFile = (window as any).__fetchFile;

      const newBlobs = new Map<number, Blob>();

      for (let i = 0; i < clips.length; i++) {
        setClippingIndex(i);
        const clip = clips[i];
        const inputName = "input" + ext(videoFile.name);
        const outputName = `clip_${i}.mp4`;

        // Write input file to ffmpeg's virtual FS
        const fileData = await fetchFile(videoFile);
        await ffmpeg.writeFile(inputName, fileData);

        // Cut the segment (fast seek to nearest keyframe)
        await ffmpeg.exec([
          "-ss", String(clip.start),
          "-i", inputName,
          "-to", String(clip.end),
          "-c", "copy",
          outputName,
        ]);

        const data = await ffmpeg.readFile(outputName);
        newBlobs.set(i, new Blob([data], { type: "video/mp4" }));

        // Clean up
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      }

      setClippedBlobs(newBlobs);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clipping failed. Try again.");
      setStep("results");
    }
  };

  function ext(name: string): string {
    const i = name.lastIndexOf(".");
    return i >= 0 ? name.slice(i) : ".mp4";
  }

  // -----------------------------------------------------------------------
  // Step 4 — Download
  // -----------------------------------------------------------------------

  const downloadClip = (index: number) => {
    const blob = clippedBlobs.get(index);
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `viralcut_clip_${index + 1}.mp4`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadAll = () => {
    for (let i = 0; i < clips.length; i++) {
      downloadClip(i);
    }
  };

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  const reset = () => {
    setStep("url");
    setUrl("");
    setError(null);
    setVideoId(null);
    setClips([]);
    setVideoFile(null);
    setClippedBlobs(new Map());
    setClippingIndex(-1);
    setClipProgress(0);
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-heading font-bold text-foreground tracking-tight">
              Viral<span className="text-primary">Cut</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full border border-primary/20">
              <Sparkles className="w-3 h-3" />
              AI Clips
            </span>
          </div>
          {step !== "url" && (
            <button
              onClick={reset}
              className="text-sm text-foreground/50 hover:text-foreground transition-colors duration-150 cursor-pointer"
            >
              Start over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        {/* ── Error banner ── */}
        {error && (
          <div className="mb-8 bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3" role="alert">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-destructive font-medium text-sm">Something went wrong</p>
              <p className="text-foreground/60 text-sm mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-foreground/30 hover:text-foreground/60 transition-colors cursor-pointer"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* STEP 1 — URL Input */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {step === "url" && (
          <div className="flex flex-col items-center text-center">
            {/* Hero */}
            <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
              <Scissors className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-heading font-bold text-foreground tracking-tight mb-3">
              Turn YouTube videos into{" "}
              <span className="text-primary">viral clips</span>
            </h1>
            <p className="text-foreground/50 text-sm sm:text-base max-w-lg mb-10 leading-relaxed">
              Paste any YouTube URL. AI finds the best moments, then you clip and download — no sign-up, no config.
            </p>

            {/* Input */}
            <div className="w-full max-w-xl">
              <label htmlFor="youtube-url" className="sr-only">
                YouTube video URL
              </label>
              <div className="relative">
                <SiYoutube className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/30 pointer-events-none" />
                <input
                  id="youtube-url"
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitUrl()}
                  className="w-full bg-muted border border-border rounded-xl pl-12 pr-4 py-4 text-base text-foreground placeholder:text-foreground/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent transition-all duration-150 outline-none"
                  autoFocus
                  aria-describedby={error ? "url-error" : undefined}
                  aria-invalid={!!error}
                />
              </div>
              {error && (
                <p id="url-error" className="text-destructive text-sm mt-2 text-left" role="alert">
                  {error}
                </p>
              )}
              <button
                onClick={handleSubmitUrl}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-accent text-white font-semibold py-4 px-6 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Sparkles className="w-5 h-5" />
                Generate Clips with AI
              </button>
            </div>

            {/* Trust signals */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-foreground/30 text-xs">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                No sign-up
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                AI-powered
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Clips in your browser
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Free to use
              </span>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* STEP 2 — Analyzing */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {step === "analyzing" && (
          <div className="flex flex-col items-center text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-2xl font-heading font-semibold text-foreground mb-2">
              AI is analyzing your video
            </h2>
            <p className="text-foreground/50 text-sm max-w-md">
              Scanning for viral moments, engagement peaks, and clip-worthy segments. This usually takes 30–60 seconds.
            </p>
            <div className="mt-8 w-64 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* STEP 3 — Results + Upload */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {step === "results" && (
          <div>
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-1">
                Found {clips.length} clip-worthy moments
              </h2>
              <p className="text-foreground/50 text-sm">
                Upload your original video file to clip these segments.
              </p>
            </div>

            {/* Clip suggestions */}
            <div className="space-y-3 mb-10">
              {clips.map((clip, i) => (
                <div
                  key={i}
                  className="bg-muted border border-border rounded-xl p-4 flex items-start gap-4 hover:border-primary/20 transition-colors duration-150"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                    <Film className="w-5 h-5 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-foreground font-medium text-sm mb-0.5">
                      {clip.title}
                    </h3>
                    <p className="text-foreground/50 text-xs mb-1.5 line-clamp-2">
                      {clip.reason}
                    </p>
                    <span className="inline-flex items-center gap-1 text-accent text-xs font-medium">
                      <Scissors className="w-3 h-3" />
                      {formatTime(clip.start)} – {formatTime(clip.end)}
                      <span className="text-foreground/30 font-normal">
                        ({formatDuration(clip.end - clip.start)})
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* File upload */}
            <div className="bg-muted border border-border rounded-xl p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Upload your video file
              </h3>
              <p className="text-foreground/50 text-sm mb-5">
                Select the original video file from your computer. Clipping happens locally — nothing is uploaded to a server.
              </p>

              {!videoFile ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/30 transition-colors duration-150 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                  aria-label="Upload video file"
                >
                  <Upload className="w-8 h-8 text-foreground/20 mx-auto mb-3" />
                  <p className="text-foreground/50 text-sm">
                    Drop your video file here, or{" "}
                    <span className="text-accent underline underline-offset-2">browse</span>
                  </p>
                  <p className="text-foreground/30 text-xs mt-1">
                    MP4, MOV, AVI — up to 2GB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="bg-background border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <FileVideo className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-medium truncate">
                      {videoFile.name}
                    </p>
                    <p className="text-foreground/40 text-xs">
                      {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => { setVideoFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-foreground/30 hover:text-foreground/60 text-sm transition-colors cursor-pointer"
                    aria-label="Remove file"
                  >
                    ✕
                  </button>
                </div>
              )}

              <button
                onClick={handleClipAll}
                disabled={!videoFile}
                className="mt-5 w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold py-3.5 px-6 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Scissors className="w-5 h-5" />
                {ffmpegLoading ? "Loading video engine..." : `Clip ${clips.length} segment${clips.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* STEP 4 — Clipping */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {step === "clipping" && (
          <div className="flex flex-col items-center text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-2xl font-heading font-semibold text-foreground mb-2">
              Clipping your video
            </h2>
            <p className="text-foreground/50 text-sm max-w-md mb-8">
              {clippingIndex >= 0
                ? `Cutting segment ${clippingIndex + 1} of ${clips.length}`
                : "Preparing the video engine..."}
            </p>
            <div className="w-full max-w-sm">
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${clipProgress}%` }}
                />
              </div>
              <p className="text-foreground/30 text-xs mt-2">{clipProgress}%</p>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* STEP 5 — Done */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {step === "done" && (
          <div>
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              </div>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-1">
                Clips are ready!
              </h2>
              <p className="text-foreground/50 text-sm">
                {clips.length} clip{clips.length === 1 ? " is" : "s are"} processed and ready to download.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {clips.map((clip, i) => {
                const hasBlob = clippedBlobs.has(i);
                return (
                  <div
                    key={i}
                    className="bg-muted border border-border rounded-xl p-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-foreground font-medium text-sm">
                        {clip.title}
                      </h3>
                      <p className="text-foreground/40 text-xs">
                        {formatTime(clip.start)} – {formatTime(clip.end)}
                        {" · "}
                        {formatDuration(clip.end - clip.start)}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadClip(i)}
                      disabled={!hasBlob}
                      className="flex items-center gap-2 bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 active:scale-[0.97] transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={downloadAll}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white font-semibold py-3.5 px-6 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                <Download className="w-5 h-5" />
                Download All ({clips.length})
              </button>
              <button
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-2 bg-muted border border-border text-foreground font-semibold py-3.5 px-6 rounded-xl hover:bg-border/30 active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                <Sparkles className="w-5 h-5" />
                Clip Another Video
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-foreground/30 text-xs">
          &copy; {new Date().getFullYear()} ViralCut. All clipping happens locally in your browser.
        </div>
      </footer>
    </div>
  );
}