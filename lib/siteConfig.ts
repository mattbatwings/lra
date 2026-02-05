export type SiteConfig = {
  lfsExtensions: string[];
  siteName: string;
  siteDescription: string;
  pageDescriptions: {
    archives: string;
    dictionary: string;
    dictionaryExampleEntry: string;
  };
  logoSrc: string;
  basePath: string;
  assetPrefix?: string;
  siteOrigin: string;
  siteUrl: string;
  archiveRepo: {
    owner: string;
    repo: string;
    branch: string;
  };
  discordInviteUrl?: string;
  repositoryUrl?: string;
};

const normalizeBasePath = (value: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailing = withLeading.endsWith("/") ? withLeading.slice(0, -1) : withLeading;
  return withoutTrailing;
};

// Deployment configuration lives here rather than env variables.
const siteOrigin = "https://llamamc.org";
// Set to "/viewer" (or "" for root) depending on where the site is hosted.
const basePath = normalizeBasePath("website-template");
const assetPrefix = basePath || undefined;
const siteUrl = `${siteOrigin.replace(/\/+$/, "")}${basePath || ""}`;

export const siteConfig: SiteConfig = {
  siteName: "Example Archive",
  siteDescription: "Example archive website built with the LlamaMC Archive Template.",
  pageDescriptions: {
    archives: "Explore an archive of example designs and creations.",
    dictionary: "An example dictionary of terms and concepts.",
    dictionaryExampleEntry: "This is an example dictionary entry used for demonstration purposes.",
  },
  logoSrc: `${basePath}/logo.jpg`,
  basePath,
  assetPrefix,
  siteOrigin,
  siteUrl,
  archiveRepo: {
    owner: "Llama-Collective",
    repo: "demo-archive",
    branch: "main",
  },
  lfsExtensions: ["mp4", "bin", "zip"],
  repositoryUrl: "https://github.com/Llama-Collective/demo-archive",
  discordInviteUrl: "https://discord.gg/J2M6fHYQnY",
};
