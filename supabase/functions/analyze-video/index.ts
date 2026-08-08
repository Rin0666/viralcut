import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TWELVELABS_API_KEY = Deno.env.get("TWELVELABS_API_KEY");
const TWELVELABS_ANALYZE_URL = "https://api.twelvelabs.io/v1.3/analyze";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClipSuggestion {
  start: number;
  end: number;
  title: string;
  reason: string;
}

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/**
 * Calls Twelve Labs video analysis API with a prompt tuned for short-form clips.
 */
async function analyzeWithTwelveLabs(videoUrl: string): Promise<ClipSuggestion[]> {
  if (!TWELVELABS_API_KEY) {
    throw new Error("TWELVELABS_API_KEY is not configured");
  }

  const response = await fetch(TWELVELABS_ANALYZE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": TWELVELABS_API_KEY,
    },
    body: JSON.stringify({
      type: "multi_modal",
      data: {
        video_url: videoUrl,
      },
      options: {
        // Ask the model for viral clip-worthy moments
        prompt: `Identify 3 to 5 short, viral-worthy moments from this video.
For each moment, provide:
- "title" (catchy, max 8 words)
- "reason" (why it works as a short clip)
- "start" (start time in seconds)
- "end" (end time in seconds)

Each clip must be between 30 and 90 seconds long.
Return ONLY a valid JSON array in this exact format, with no additional commentary:
[
  {"title": "...", "reason": "...", "start": 0, "end": 45},
  ...
]`,
        temperature: 0.3,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Twelve Labs analysis request failed (${response.status}): ${text}`,
    );
  }

  const result = await response.json();
  const content = result?.data ?? result;

  if (!content) {
    throw new Error("Empty response from Twelve Labs");
  }

  // Try to parse JSON from the response
  const rawText = typeof content === "string" ? content : JSON.stringify(content);
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Could not parse clip suggestions from Twelve Labs response");
  }

  const suggestions: ClipSuggestion[] = JSON.parse(jsonMatch[0]);

  return suggestions
    .filter((c) => typeof c.start === "number" && typeof c.end === "number")
    .map((c) => ({
      start: Math.max(0, Math.floor(c.start)),
      end: Math.floor(c.end),
      title: c.title || "Clip",
      reason: c.reason || "",
    }))
    .filter((c) => c.end > c.start);
}

/**
 * Fallback analyzer based on YouTube video metadata.
 * We attempt an oEmbed lookup for the title, then generate deterministic
 * "pseudo-viral" timestamps based on video length.
 */
async function generateFallbackClips(videoUrl: string): Promise<{
  clips: ClipSuggestion[];
  source: "fallback";
}> {
  const videoId = extractYouTubeId(videoUrl);
  let title: string | undefined;

  if (videoId) {
    try {
      const oembed = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${videoId}`,
        )}&format=json`,
      );
      if (oembed.ok) {
        const data = await oembed.json();
        title = data.title;
      }
    } catch {
      // ignore metadata fetch failures
    }
  }

  // No duration info available from oEmbed. Use a few short default segments.
  const hookClip: ClipSuggestion = {
    start: 0,
    end: 45,
    title: "Strong hook",
    reason: "Start of the video where the main topic or question is introduced — great attention grabber.",
  };
  const midClip: ClipSuggestion = {
    start: 60,
    end: 105,
    title: "Key insight",
    reason: "A likely high-value section after the intro. Cut and refine to keep momentum.",
  };
  const finalClip: ClipSuggestion = {
    start: 180,
    end: 240,
    title: "Memorable moment",
    reason: "Later section that often contains a story payoff, example, or emotional peak.",
  };

  const clips = [hookClip, midClip, finalClip].filter((c) => !title || c.start >= 0);

  if (title) {
    clips[0] = {
      ...clips[0],
      title: `${title}: Hook`,
    };
  }

  return { clips, source: "fallback" };
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  );
  return match?.[1] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return respond(405, { error: { message: "Method not allowed" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const videoUrl = body.videoUrl;

    if (!videoUrl || typeof videoUrl !== "string" || !extractYouTubeId(videoUrl)) {
      return respond(400, {
        error: {
          message: "A valid YouTube videoUrl is required.",
        },
      });
    }

    let clips: ClipSuggestion[];
    let source: "twelvelabs" | "fallback" = "twelvelabs";

    if (!TWELVELABS_API_KEY) {
      // Use fallback if no key is configured
      const fallback = await generateFallbackClips(videoUrl);
      clips = fallback.clips;
      source = fallback.source;
    } else {
      try {
        clips = await analyzeWithTwelveLabs(videoUrl);
      } catch (err) {
        console.error("Twelve Labs analysis failed, using fallback:", err);
        const fallback = await generateFallbackClips(videoUrl);
        clips = fallback.clips;
        source = fallback.source;
      }
    }

    return respond(200, { clips, source });
  } catch (err) {
    console.error("analyze-video error:", err);
    return respond(500, {
      error: {
        message: err instanceof Error ? err.message : "Analysis failed",
      },
    });
  }
});
