import { siteConfig } from "@/lib/siteConfig";

export type JsonLdNode = Record<string, unknown>;

export type JsonLdGraph = {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
};

type PageType = "WebPage" | "CollectionPage" | "AboutPage";

type PageJsonLdInput = {
  path: string;
  title: string;
  description: string;
  type?: PageType;
  imagePath?: string;
};

type PageNodeInput = PageJsonLdInput & {
  mainEntityId?: string;
  breadcrumbId?: string;
};

export type CollectionItem = {
  name: string;
  url: string;
  description?: string;
  type?: string;
  imagePath?: string;
  datePublished?: number;
  dateModified?: number;
  keywords?: string[];
  extra?: Record<string, unknown>;
};

type CollectionPageJsonLdInput = PageJsonLdInput & {
  items: CollectionItem[];
  numberOfItems?: number;
};

type AboutPageJsonLdInput = PageJsonLdInput & {
  members: Array<{ name: string; role?: string }>;
};

type ArchiveArticleJsonLdInput = {
  slug: string;
  title: string;
  description: string;
  imagePath?: string;
  authors?: string[];
  tags?: string[];
  publishedAt?: number;
  modifiedAt?: number;
  channelName?: string;
  categoryName?: string;
};

type DictionaryTermJsonLdInput = {
  slug: string;
  id: string;
  title: string;
  description: string;
  terms: string[];
  definition?: string;
  threadURL?: string;
  statusURL?: string;
};

type FaqPageJsonLdInput = PageJsonLdInput & {
  items: Array<{
    question: string;
    answer: string;
  }>;
};

const organizationId = `${siteConfig.siteUrl}#organization`;
const websiteId = `${siteConfig.siteUrl}#website`;
const dictionarySetId = `${siteConfig.siteUrl}/dictionary/#termset`;
const sameAs = [siteConfig.discordInviteUrl, siteConfig.repositoryUrl].filter(
  (value): value is string => Boolean(value),
);

const withLeadingSlash = (path: string) => (path.startsWith("/") ? path : `/${path}`);

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const toAbsoluteUrl = (pathOrUrl: string) => {
  if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl;
  const path = withLeadingSlash(pathOrUrl);
  // Paths are site-relative; some (e.g. logoSrc) already include the base path.
  const basePath = siteConfig.basePath || "";
  const fullPath = basePath && (path === basePath || path.startsWith(`${basePath}/`)) ? path : `${basePath}${path}`;
  return new URL(fullPath, siteConfig.siteOrigin).toString();
};

const toIsoDate = (timestamp?: number) => {
  if (!timestamp || !Number.isFinite(timestamp)) return undefined;
  const normalized = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  return new Date(normalized).toISOString();
};

const uniqueNonEmpty = (values: string[] = []) => (
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
);

const createGraph = (...nodes: JsonLdNode[]): JsonLdGraph => ({
  "@context": "https://schema.org",
  "@graph": nodes,
});

const createOrganizationNode = (): JsonLdNode => ({
  "@type": "Organization",
  "@id": organizationId,
  name: siteConfig.siteName,
  url: siteConfig.siteUrl,
  description: siteConfig.siteDescription,
  logo: {
    "@type": "ImageObject",
    url: toAbsoluteUrl(siteConfig.logoSrc),
  },
  ...(sameAs.length > 0 ? { sameAs } : {}),
});

const createWebsiteNode = (): JsonLdNode => ({
  "@type": "WebSite",
  "@id": websiteId,
  url: siteConfig.siteUrl,
  name: siteConfig.siteName,
  description: siteConfig.siteDescription,
  inLanguage: "en-US",
  publisher: {
    "@id": organizationId,
  },
});

const createPageNode = ({
  path,
  title,
  description,
  type = "WebPage",
  imagePath,
  mainEntityId,
  breadcrumbId,
}: PageNodeInput): JsonLdNode => {
  const pageUrl = toAbsoluteUrl(path);
  return {
    "@type": type,
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: title,
    description,
    inLanguage: "en-US",
    isPartOf: {
      "@id": websiteId,
    },
    about: {
      "@id": organizationId,
    },
    ...(imagePath
      ? {
          primaryImageOfPage: {
            "@type": "ImageObject",
            url: toAbsoluteUrl(imagePath),
          },
        }
      : {}),
    ...(mainEntityId ? { mainEntity: { "@id": mainEntityId } } : {}),
    ...(breadcrumbId ? { breadcrumb: { "@id": breadcrumbId } } : {}),
  };
};

const createItemNode = (item: CollectionItem): JsonLdNode => {
  const itemUrl = toAbsoluteUrl(item.url);
  const keywords = uniqueNonEmpty(item.keywords);
  const datePublished = toIsoDate(item.datePublished);
  const dateModified = toIsoDate(item.dateModified);

  return {
    "@type": item.type || "Thing",
    "@id": `${itemUrl}#item`,
    name: item.name,
    url: itemUrl,
    ...(item.description ? { description: item.description } : {}),
    ...(item.imagePath ? { image: toAbsoluteUrl(item.imagePath) } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    ...(keywords.length ? { keywords } : {}),
    ...(item.extra ?? {}),
  };
};

const createListItemNode = (item: CollectionItem, position: number): JsonLdNode => {
  const itemUrl = toAbsoluteUrl(item.url);
  return {
    "@type": "ListItem",
    position,
    name: item.name,
    url: itemUrl,
    item: {
      "@id": `${itemUrl}#item`,
    },
  };
};

const createBreadcrumbNode = (path: string, title: string, parentName: string, parentPath: string): JsonLdNode => {
  const pageUrl = toAbsoluteUrl(path);
  const siteTitleSuffix = ` | ${siteConfig.siteName}`;
  const breadcrumbTitle = title.endsWith(siteTitleSuffix)
    ? title.slice(0, -siteTitleSuffix.length)
    : title;

  return {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: siteConfig.siteName,
        item: siteConfig.siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: parentName,
        item: toAbsoluteUrl(parentPath),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: breadcrumbTitle,
        item: pageUrl,
      },
    ],
  };
};

export function createPageJsonLd({
  path,
  title,
  description,
  type = "WebPage",
  imagePath,
}: PageJsonLdInput): JsonLdGraph {
  return createGraph(
    createOrganizationNode(),
    createWebsiteNode(),
    createPageNode({ path, title, description, type, imagePath }),
  );
}

export function createCollectionPageJsonLd({
  path,
  title,
  description,
  type = "CollectionPage",
  imagePath,
  items,
  numberOfItems,
}: CollectionPageJsonLdInput): JsonLdGraph {
  const pageUrl = toAbsoluteUrl(path);
  const itemListId = `${pageUrl}#itemlist`;
  const itemNodes = items.map((item) => createItemNode(item));
  const listItemNodes = items.map((item, index) => createListItemNode(item, index + 1));

  return createGraph(
    createOrganizationNode(),
    createWebsiteNode(),
    createPageNode({
      path,
      title,
      description,
      type,
      imagePath,
      mainEntityId: itemListId,
    }),
    {
      "@type": "ItemList",
      "@id": itemListId,
      name: `${title} items`,
      numberOfItems: numberOfItems ?? items.length,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement: listItemNodes,
    },
    ...itemNodes,
  );
}

export function createAboutPageJsonLd({
  path,
  title,
  description,
  imagePath,
  members,
}: AboutPageJsonLdInput): JsonLdGraph {
  const cleanMembers = members
    .map((member) => ({
      name: member.name.trim(),
      role: member.role?.trim(),
    }))
    .filter((member) => Boolean(member.name));

  return createGraph(
    createOrganizationNode(),
    createWebsiteNode(),
    createPageNode({
      path,
      title,
      description,
      type: "AboutPage",
      imagePath,
      mainEntityId: organizationId,
    }),
    {
      "@type": "Organization",
      "@id": organizationId,
      ...(cleanMembers.length
        ? {
            member: cleanMembers.map((member) => ({
              "@type": "Person",
              name: member.name,
              ...(member.role ? { description: member.role } : {}),
            })),
          }
        : {}),
    },
  );
}

export function createArchiveArticleJsonLd({
  slug,
  title,
  description,
  imagePath,
  authors = [],
  tags = [],
  publishedAt,
  modifiedAt,
  channelName,
  categoryName,
}: ArchiveArticleJsonLdInput): JsonLdGraph {
  const path = `/archives/${slug}/`;
  const pageUrl = toAbsoluteUrl(path);
  const articleId = `${pageUrl}#article`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;
  const articleAuthors = uniqueNonEmpty(authors).map((name) => ({
    "@type": "Person",
    name,
  }));
  const keywords = uniqueNonEmpty(tags);
  const datePublished = toIsoDate(publishedAt);
  const dateModified = toIsoDate(modifiedAt ?? publishedAt);
  const about = uniqueNonEmpty([channelName ?? "", categoryName ?? ""]).map((name) => ({
    "@type": "Thing",
    name,
  }));

  return createGraph(
    createOrganizationNode(),
    createWebsiteNode(),
    createPageNode({
      path,
      title,
      description,
      type: "WebPage",
      imagePath,
      mainEntityId: articleId,
      breadcrumbId,
    }),
    {
      "@type": "TechArticle",
      "@id": articleId,
      headline: title,
      name: title,
      description,
      url: pageUrl,
      mainEntityOfPage: {
        "@id": `${pageUrl}#webpage`,
      },
      publisher: {
        "@id": organizationId,
      },
      author: articleAuthors.length ? articleAuthors : { "@id": organizationId },
      ...(imagePath ? { image: [toAbsoluteUrl(imagePath)] } : {}),
      ...(datePublished ? { datePublished } : {}),
      ...(dateModified ? { dateModified } : {}),
      ...(keywords.length ? { keywords } : {}),
      ...(channelName ? { articleSection: channelName } : {}),
      ...(about.length ? { about } : {}),
    },
    createBreadcrumbNode(path, title, "Archives", "/archives/"),
  );
}

export function createDictionaryTermJsonLd({
  slug,
  id,
  title,
  description,
  terms,
  definition,
  threadURL,
  statusURL,
}: DictionaryTermJsonLdInput): JsonLdGraph {
  const path = `/dictionary/${slug}/`;
  const pageUrl = toAbsoluteUrl(path);
  const termId = `${pageUrl}#definedterm`;
  const cleanTerms = uniqueNonEmpty(terms);
  const primaryTerm = cleanTerms[0] || id;
  const alternateNames = cleanTerms.slice(1);
  const sameAsUrls = [threadURL, statusURL]
    .filter((value): value is string => Boolean(value))
    .map((value) => toAbsoluteUrl(value));

  return createGraph(
    createOrganizationNode(),
    createWebsiteNode(),
    createPageNode({
      path,
      title,
      description,
      type: "WebPage",
      mainEntityId: termId,
    }),
    {
      "@type": "DefinedTermSet",
      "@id": dictionarySetId,
      name: `Dictionary · ${siteConfig.siteName}`,
      description: siteConfig.pageDescriptions.dictionary,
      url: toAbsoluteUrl("/dictionary/"),
      isPartOf: {
        "@id": websiteId,
      },
    },
    {
      "@type": "DefinedTerm",
      "@id": termId,
      name: primaryTerm,
      termCode: id,
      description: definition || description,
      url: pageUrl,
      inDefinedTermSet: {
        "@id": dictionarySetId,
      },
      ...(alternateNames.length ? { alternateName: alternateNames } : {}),
      ...(sameAsUrls.length ? { sameAs: sameAsUrls } : {}),
    },
  );
}

export function createFaqPageJsonLd({
  path,
  title,
  description,
  imagePath,
  items,
}: FaqPageJsonLdInput): JsonLdGraph {
  const pageUrl = toAbsoluteUrl(path);
  const faqId = `${pageUrl}#faq`;
  const mainEntity = items
    .map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    }))
    .filter((item) => item.question && item.answer)
    .map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    }));

  return createGraph(
    createOrganizationNode(),
    createWebsiteNode(),
    createPageNode({
      path,
      title,
      description,
      type: "WebPage",
      imagePath,
      mainEntityId: faqId,
    }),
    {
      "@type": "FAQPage",
      "@id": faqId,
      name: title,
      description,
      url: pageUrl,
      mainEntity,
      isPartOf: {
        "@id": websiteId,
      },
      about: {
        "@id": organizationId,
      },
    },
  );
}
