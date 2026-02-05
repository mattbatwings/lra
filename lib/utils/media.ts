export function getYouTubeEmbedURL(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") {
      id = u.pathname.slice(1).split("/")[0] || null;
    } else if (host.endsWith("youtube.com")) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2] || null;
      else if (u.pathname.startsWith("/embed/")) return raw;
    }
    if (!id) return null;
    const start = u.searchParams.get("t") || u.searchParams.get("start");
    const qs = start ? `?start=${encodeURIComponent(start)}&rel=0` : "?rel=0";
    return `https://www.youtube.com/embed/${id}${qs}`;
  } catch {
    return null;
  }
}
