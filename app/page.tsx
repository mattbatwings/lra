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
      title: "A curated archive",
      body: "A list of useful logical redstone designs and creations submitted by community members.",
      href: "/archives",
      cta: "Browse the archive",
    },
    {
      title: "Living dictionary",
      body: "An ever-growing dictionary of terms and concepts related to logical redstone.",
      href: "/dictionary",
      cta: "Open the dictionary",
    },
    {
      title: "Mods and tools",
      body: "Discover the best mods and tools to enhance your Minecraft experience and streamline your building process.",
      href: "/mods-and-tools",
      cta: "See the recommendations",
    },
    {
      title: "Community-first",
      body: "Join our discord to learn, share new designs, and get in touch with our community",
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
              Welcome to LlamaMC Archive
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">The community for storage innovators</h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-900 dark:text-gray-200">
              This is an example archive website built with the LlamaMC Archive Template. Feel free to explore the
              archive and dictionary to see how the template works, and imagine what you could build with your own
              archive!
            </p>
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

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">Built by the community, for the community</h2>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">

            <p className="text-base leading-relaxed text-gray-900 dark:text-gray-200">
                The LlamaMC Archive Template is an open-source project developed by the Llama Collective, designed to
                empower communities to create and share their own archives of Minecraft storage technologies.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
