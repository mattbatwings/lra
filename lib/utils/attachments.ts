import { type Attachment } from "@/lib/types";

const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;

export function replaceAttachmentsInText(text: string, attachments: Attachment[]): string {
  let finalText = text;
  const urls = text.match(URL_REGEX);
  if (!urls) return finalText;

  urls.forEach((url) => {
    let match: Attachment | undefined;
    if (url.startsWith("https://www.mediafire.com/file/") || url.startsWith("https://www.mediafire.com/folder/")) {
      const id = url.split("/")[4];
      match = attachments.find((attachment) => attachment.id === id);
    } else if (url.startsWith("https://youtu.be/") || url.startsWith("https://www.youtube.com/watch")) {
      const videoId = new URL(url).searchParams.get("v") || url.split("/").pop();
      if (!videoId) return;
      match = attachments.find((attachment) => attachment.id === videoId);
    } else if (url.startsWith("https://cdn.discordapp.com/attachments/")) {
      const segments = url.split("/");
      const id = segments[5];
      match = attachments.find((attachment) => attachment.id === id);
    } else if (url.startsWith("https://bilibili.com/") || url.startsWith("https://www.bilibili.com/")) {
      const urlObj = new URL(url);
      const videoId = urlObj.pathname.split("/")[2] || urlObj.searchParams.get("bvid");
      if (!videoId) return;
      match = attachments.find((attachment) => attachment.id === videoId);
    }
    if (!match) return;
    const split = finalText.split(url);
    if (split.length <= 1) return;
    const replaced = [split[0]];
    for (let i = 1; i < split.length; i += 1) {
      const prev = split[i - 1];
      if (prev.endsWith("](") && split[i].startsWith(")")) {
        replaced.push((match.canDownload ? match.path : url) || "");
      } else {
        replaced.push(`[${match.name || "Attachment"}](${match.canDownload ? match.path : url})`);
      }
      replaced.push(split[i]);
    }
    finalText = replaced.join("");
  });
  return finalText;
}
