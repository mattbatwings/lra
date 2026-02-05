import { type ArchiveListItem } from "../archive";
import { unique } from "./arrays";
import { normalize } from "./strings";

export function getPostTagsNormalized(p: ArchiveListItem): string[] {
  const entryTags = p.entry.tags;
  return unique([...entryTags]).map(normalize);
}
