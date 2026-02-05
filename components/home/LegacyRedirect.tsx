'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchArchiveIndex, fetchDictionaryIndex } from "@/lib/archive";
import { buildDictionarySlug } from "@/lib/dictionary";

export function LegacyRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const id = sp.get("id");
    const did = sp.get("did");
    if (!id && !did) return;

    let cancelled = false;
    const run = async () => {
      if (id) {
        try {
          const archive = await fetchArchiveIndex();
          const lower = id.toLowerCase();
          const match = archive.posts.find(
            (p) =>
              p.entry.id === id ||
              p.entry.codes[0] === id ||
              p.entry.codes.some((code) => code.toLowerCase() === lower) ||
              p.slug.toLowerCase() === lower,
          );
          if (match && !cancelled) {
            router.replace(`/archives/${match.slug}`);
            return;
          }
        } catch {
          // Ignore and fall through to dictionary check
        }
      }

      if (did) {
        try {
          const dictionary = await fetchDictionaryIndex();
          const entry = dictionary.entries.find((e) => e.index.id === did);
          if (entry && !cancelled) {
            router.replace(`/dictionary/${encodeURIComponent(buildDictionarySlug(entry.index))}`);
          }
        } catch {
          // Ignore if dictionary fetch fails
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
