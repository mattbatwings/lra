'use client';

import { siteConfig } from "@/lib/siteConfig";

export function Footer() {
  return (
    <footer className="border-t py-6 text-center text-xs text-gray-500 dark:text-gray-400">
      Built for the {siteConfig.siteName}.
      <a href="https://llamamc.org/" className="underline">Join the Llama Collective</a> to contribute or support development.
    </footer>
  );
}
