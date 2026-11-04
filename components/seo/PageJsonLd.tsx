import { createPageJsonLd, type JsonLdGraph } from "@/lib/jsonLd";

type BasicPageJsonLdProps = {
  path: string;
  title: string;
  description: string;
  type?: "WebPage" | "CollectionPage" | "AboutPage";
  imagePath?: string;
};

type CustomPageJsonLdProps = {
  data: JsonLdGraph;
};

type PageJsonLdProps = BasicPageJsonLdProps | CustomPageJsonLdProps;

export function PageJsonLd(props: PageJsonLdProps) {
  const jsonLd = "data" in props
    ? props.data
    : createPageJsonLd({
      path: props.path,
      title: props.title,
      description: props.description,
      type: props.type,
      imagePath: props.imagePath,
    });

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
