/**
 * YouTube Data API v3 client.
 * All functions require an OAuth access token from the authenticated user.
 */

// Publishable API key — replace with your Google Cloud API key.
// This is NOT a secret; it's sent with every request for quota tracking.
export const YOUTUBE_API_KEY = "YOUR_YOUTUBE_API_KEY";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
  uploadsPlaylistId: string;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ytGet<T>(
  endpoint: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${YT_BASE}/${endpoint}`);
  url.searchParams.set("key", YOUTUBE_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      body?.error?.message ?? `YouTube API error (${res.status})`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

function thumbnailUrl(thumbnails: Record<string, { url: string }>): string {
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    ""
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch the authenticated user's YouTube channel. */
export async function getMyChannel(
  accessToken: string,
): Promise<YouTubeChannel> {
  const data = await ytGet<{
    items: Array<{
      id: string;
      snippet: {
        title: string;
        description: string;
        thumbnails: Record<string, { url: string }>;
      };
      statistics: {
        subscriberCount: string;
        videoCount: string;
      };
      contentDetails: {
        relatedPlaylists: { uploads: string };
      };
    }>;
  }>("channels", accessToken, {
    part: "snippet,statistics,contentDetails",
    mine: "true",
  });

  if (!data.items?.length) throw new Error("No YouTube channel found.");

  const ch = data.items[0];
  return {
    id: ch.id,
    title: ch.snippet.title,
    description: ch.snippet.description,
    thumbnail: thumbnailUrl(ch.snippet.thumbnails),
    subscriberCount: parseInt(ch.statistics.subscriberCount, 10) || 0,
    videoCount: parseInt(ch.statistics.videoCount, 10) || 0,
    uploadsPlaylistId: ch.contentDetails.relatedPlaylists.uploads,
  };
}

/** Fetch videos from an uploads playlist. */
export async function getChannelVideos(
  accessToken: string,
  uploadsPlaylistId: string,
  maxResults = 50,
): Promise<YouTubeVideo[]> {
  const data = await ytGet<{
    items: Array<{
      contentDetails: { videoId: string };
      snippet: {
        title: string;
        description: string;
        thumbnails: Record<string, { url: string }>;
        publishedAt: string;
      };
    }>;
  }>("playlistItems", accessToken, {
    part: "snippet,contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: String(maxResults),
  });

  return (data.items ?? []).map((item) => ({
    id: item.contentDetails.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: thumbnailUrl(item.snippet.thumbnails),
    publishedAt: item.snippet.publishedAt,
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    duration: "",
  }));
}

/** Fetch statistics for a batch of video IDs. */
export async function getVideoStats(
  accessToken: string,
  videoIds: string[],
): Promise<Map<string, { viewCount: number; likeCount: number; commentCount: number; duration: string }>> {
  const map = new Map<
    string,
    { viewCount: number; likeCount: number; commentCount: number; duration: string }
  >();

  if (videoIds.length === 0) return map;

  const data = await ytGet<{
    items: Array<{
      id: string;
      statistics: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
      contentDetails: { duration: string };
    }>;
  }>("videos", accessToken, {
    part: "statistics,contentDetails",
    id: videoIds.join(","),
    maxResults: "50",
  });

  for (const item of data.items ?? []) {
    map.set(item.id, {
      viewCount: parseInt(item.statistics?.viewCount ?? "0", 10) || 0,
      likeCount: parseInt(item.statistics?.likeCount ?? "0", 10) || 0,
      commentCount: parseInt(item.statistics?.commentCount ?? "0", 10) || 0,
      duration: item.contentDetails?.duration ?? "",
    });
  }

  return map;
}

/**
 * Fetch the user's top videos sorted by view count (descending).
 * Combines playlistItems + videos endpoints.
 */
export async function getTopVideos(
  accessToken: string,
  uploadsPlaylistId: string,
  count = 24,
): Promise<YouTubeVideo[]> {
  const videos = await getChannelVideos(accessToken, uploadsPlaylistId);

  if (videos.length === 0) return [];

  const statsMap = await getVideoStats(
    accessToken,
    videos.map((v) => v.id),
  );

  // Merge stats into videos
  const merged: YouTubeVideo[] = videos.map((v) => {
    const stats = statsMap.get(v.id);
    return {
      ...v,
      viewCount: stats?.viewCount ?? 0,
      likeCount: stats?.likeCount ?? 0,
      commentCount: stats?.commentCount ?? 0,
      duration: stats?.duration ?? "",
    };
  });

  // Sort by view count descending
  merged.sort((a, b) => b.viewCount - a.viewCount);

  return merged.slice(0, count);
}
