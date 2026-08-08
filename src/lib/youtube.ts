// ---------------------------------------------------------------------------
// YouTube URL parsing — the only thing we still need
// ---------------------------------------------------------------------------

export type YouTubeLinkType =
  | { type: "video"; id: string }
  | { type: "channel"; id: string }
  | { type: "handle"; handle: string }
  | null;

/**
 * Parse a YouTube URL and return the content type + ID.
 * Supports: watch?v=, youtu.be/, /channel/, /@handle
 */
export function parseYouTubeUrl(url: string): YouTubeLinkType {
  const trimmed = url.trim();

  // Try to extract a video ID from various formats
  const videoMatch =
    trimmed.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    ) ??
    trimmed.match(/^([a-zA-Z0-9_-]{11})$/); // bare video ID

  if (videoMatch) {
    return { type: "video", id: videoMatch[1] };
  }

  // /channel/UC...
  const channelMatch = trimmed.match(
    /youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/,
  );
  if (channelMatch) {
    return { type: "channel", id: channelMatch[1] };
  }

  // /@handle or youtube.com/@handle
  const handleMatch = trimmed.match(
    /(?:youtube\.com\/)?@([a-zA-Z0-9_-]+)/,
  );
  if (handleMatch) {
    return { type: "handle", handle: handleMatch[1] };
  }

  return null;
}