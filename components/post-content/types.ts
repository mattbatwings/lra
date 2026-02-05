export type LightboxState = {
  src: string;
  alt: string;
  index?: number;
  mode: "gallery" | "single";
};

export type PdfViewerState = {
  src: string;
  title?: string;
  description?: string;
};

export type PdfPageInfo = {
  page: number;
  total: number;
};
