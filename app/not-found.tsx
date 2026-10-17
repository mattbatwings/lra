import NotFoundClient from "@/components/not-found/NotFoundClient";
import { PageJsonLd } from "@/components/seo/PageJsonLd";
import { siteConfig } from "@/lib/siteConfig";

const notFoundTitle = `Page not found · ${siteConfig.siteName}`;
const notFoundDescription = "The page you requested could not be found.";

export default function NotFound() {
  return (
    <>
      <PageJsonLd path="/404/" title={notFoundTitle} description={notFoundDescription} />
      <NotFoundClient />
    </>
  );
}
