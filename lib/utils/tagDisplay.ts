import { DEFAULT_GLOBAL_TAGS, type GlobalTag, type Tag } from "../types";
import { normalize } from "./strings";

export type SpecialTagMeta = {
  icon?: string;
  color?: string;
};

type NormalizedGlobalTag = {
  tag: GlobalTag;
  norm: string;
};

function getNormalizedGlobalTags(globalTags?: GlobalTag[]): NormalizedGlobalTag[] {
  const tags = (globalTags?.length ? globalTags : DEFAULT_GLOBAL_TAGS) || [];
  const seen = new Set<string>();
  const normalized: NormalizedGlobalTag[] = [];
  tags.forEach((tag) => {
    const norm = normalize(tag.name);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    normalized.push({ tag, norm });
  });
  return normalized;
}

export function getSpecialTagMeta(name: string, globalTags?: GlobalTag[]): SpecialTagMeta | undefined {
  const norm = normalize(name);
  const match = getNormalizedGlobalTags(globalTags).find((item) => item.norm === norm);
  if (!match) return undefined;
  return {
    icon: match.tag.emoji,
    color: match.tag.colorWeb,
  };
}

export function sortTagsForDisplay(names: string[], globalTags?: GlobalTag[]) {
  const firstByNorm: Record<string, string> = {};
  names.forEach((n) => {
    const norm = normalize(n);
    if (!firstByNorm[norm]) firstByNorm[norm] = n;
  });
  const order = getNormalizedGlobalTags(globalTags).map((item) => item.norm);
  const orderSet = new Set(order);
  const specials = order.map((norm) => firstByNorm[norm]).filter(Boolean) as string[];
  const rest = Object.entries(firstByNorm)
    .filter(([norm]) => !orderSet.has(norm))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, original]) => original);
  return [...specials, ...rest];
}

export function sortTagObjectsForDisplay(tags: Tag[], globalTags?: GlobalTag[]) {
  const byNorm = new Map<string, Tag>();
  tags.forEach((tag) => {
    const norm = normalize(tag.name);
    if (!byNorm.has(norm)) byNorm.set(norm, tag);
  });
  const order = getNormalizedGlobalTags(globalTags).map((item) => item.norm);
  const orderSet = new Set(order);
  const specials = order.map((norm) => byNorm.get(norm)).filter(Boolean) as Tag[];
  const rest = Array.from(byNorm.entries())
    .filter(([norm]) => !orderSet.has(norm))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, tag]) => tag);
  return [...specials, ...rest];
}
