import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { asyncPool, assetURL } from "../lib/github";
import { fetchArchiveIndex, fetchDictionaryIndex, type ArchiveListItem } from "../lib/archive";
import { disablePreviewOptimization } from "../lib/runtimeFlags";
import { siteConfig } from "../lib/siteConfig";
import { PreviewItem } from "@/lib/previews";

const skip = process.env.SKIP_PREVIEW_DOWNLOAD === "1";

const root = process.cwd();
const outputDir = path.join(root, "public", "previews");
const indexPath = path.join(root, "lib", "generated", "previews.json");

const MAX_WIDTH = Number.parseInt(process.env.PREVIEW_MAX_WIDTH || "1024", 10);
const MAX_HEIGHT = Number.parseInt(process.env.PREVIEW_MAX_HEIGHT || "800", 10);
const QUALITY = Number.parseInt(process.env.PREVIEW_QUALITY || "80", 10);

const normalizeBasePath = (value?: string | null) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.endsWith("/") ? withLeading.slice(0, -1) : withLeading;
};

const basePath = normalizeBasePath(siteConfig.basePath);

const withBasePath = (value: string) => {
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return basePath ? `${basePath}${normalized}` : normalized;
};

async function main() {
  if (skip || disablePreviewOptimization) {
    // save empty index file
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(
      indexPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          items: [],
        },
        null,
        2,
      ),
    );
    console.log("Skipping preview download (SKIP_PREVIEW_DOWNLOAD=1).");
    return;
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.dirname(indexPath), { recursive: true });

  const archive = await fetchArchiveIndex();
  const posts: ArchiveListItem[] = archive.posts;
  const archiveIndexPath = path.join(root, "lib", "generated", "archive-index.json");
  await fs.writeFile(archiveIndexPath, JSON.stringify(archive, null, 2));

  const previews: Array<PreviewItem> = [];

  await asyncPool(6, posts, async (post) => {
    try {
      const image = post.entry.mainImagePath;
      if (!image) return;
      const sourceUrl = assetURL(post.channel.path, post.entry.path, image);
      const res = await fetch(sourceUrl);
      if (!res.ok) return;
      const buffer = Buffer.from(await res.arrayBuffer());

      const pipeline = sharp(buffer)
        .rotate()
        .resize({
           fit: 'inside',
           height: MAX_HEIGHT,
           width: MAX_WIDTH,
           withoutEnlargement: true
        })
        .webp({ quality: QUALITY });
      const metadata = await pipeline.metadata();
      const outBuffer = await pipeline.toBuffer();

      const filename = `${post.slug}.webp`;
      const outPath = path.join(outputDir, filename);
      await fs.writeFile(outPath, outBuffer);

      previews.push({
        code: post.entry.codes[0],
        sourceUrl,
        localPath: withBasePath(`/previews/${filename}`),
        width: metadata.width,
        height: metadata.height,
      });
    } catch {
      // ignore individual failures
    }
  });

  previews.sort((a, b) => a.code.localeCompare(b.code));
  const payload = { generatedAt: new Date().toISOString(), items: previews };
  await fs.writeFile(indexPath, JSON.stringify(payload, null, 2));
  const dictionaryIndex = await fetchDictionaryIndex();
  const dictionaryIndexPath = path.join(root, "lib", "generated", "dictionary-index.json");
  await fs.writeFile(dictionaryIndexPath, JSON.stringify(dictionaryIndex, null, 2));
  console.log(`Wrote ${previews.length} previews to ${indexPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
