// "../generated/previews.json"
import previewIndex from "./generated/previews.json";

export type PreviewItem = {
  code: string;
  sourceUrl: string;
  localPath: string;
  width?: number;
  height?: number;
};

export type PreviewIndex = {
  generatedAt: string;
  items: PreviewItem[];
};

const previewIndexTyped: PreviewIndex = previewIndex as PreviewIndex;

const byCode = new Map(previewIndexTyped.items.map((item) => [item.code, item]));

export function getPreviewByCode(code: string) {
  return byCode.get(code);
}
