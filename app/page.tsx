import Image from "next/image";
import Link from "next/link";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { Footer } from "@/components/layout/Footer";
import { LegacyRedirect } from "@/components/home/LegacyRedirect";
import { siteConfig } from "@/lib/siteConfig";
import { PillarCard } from "@/components/home/PillarCard";

export default function Home() {
  const pillars = [
    {
      title: "A Curated Archive",
      body: "A list of useful logical redstone designs and creations submitted by community members.",
      href: "/archives",
      cta: "Browse the archive",
    },
    {
      title: "Living Dictionary",
      body: "An ever-growing dictionary of terms and concepts related to logical redstone.",
      href: "/dictionary",
      cta: "Open the dictionary",
    },
    {
      title: "Archive Downloader Mod",
      body: "A mod that allows you to browse and download Logical Redstone and other archives directly in-game.",
      href: "https://modrinth.com/mod/archive-downloader",
      cta: "View on Modrinth",
    },
    {
      title: "Discord Community",
      body: "Learn with peers, ask questions, and share new circuits in our Discord.",
      href: siteConfig.discordInviteUrl ?? "#",
      cta: "Join the Discord",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">
      <LegacyRedirect />
      <HeaderBar
        siteName={siteConfig.siteName}
        view="home"
        logoSrc={siteConfig.logoSrc}
        discordInviteUrl={siteConfig.discordInviteUrl}
      />

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <section className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {/* <div className="overflow-hidden rounded-t-xl border-b border-gray-200 dark:border-gray-800">
            <Image
              src="/banner.webp"
              alt="LlamaMC banner"
              width={1600}
              height={480}
              className="h-auto w-full object-cover"
              preload={true}
              fetchPriority="high"
            />
          </div> */}
          <div className="px-6 py-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              Welcome to the Logical Redstone Archive
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">The community for redstone computer nerds</h1>
          </div>
        </section>

        <section className="mt-12 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">Find exactly what you need</h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {pillars.map((pillar) => (
              <PillarCard key={pillar.title} pillar={pillar} />
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
