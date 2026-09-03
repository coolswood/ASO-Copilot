import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Compass, Gauge, Languages, MessageSquare, Settings, Tags, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import HealthReportPanel from "@/components/HealthReportPanel";
import AICopySuggestions from "@/components/AICopySuggestions";
import KeywordsSection from "@/components/KeywordsSection";
import CompetitorsSection from "@/components/CompetitorsSection";
import ResearchSection from "@/components/ResearchSection";
import GlobalReachSection from "@/components/GlobalReachSection";
import AppHeader from "@/components/AppHeader";
import ScreenshotGallery from "@/components/ScreenshotGallery";
import ReviewsSection from "@/components/ReviewsSection";
import ProductHealthChart from "@/components/ProductHealthChart";
import PostHogSettings from "@/components/PostHogSettings";
import DangerZone from "@/components/DangerZone";
import AppTabs from "@/components/AppTabs";
import LocalizationHealthSection from "@/components/LocalizationHealthSection";
import type { HealthBreakdownItem, HealthSuggestion } from "@/lib/health";

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const app = await prisma.app.findUnique({
    where: { id },
    include: {
      keywords: {
        include: { ranks: { orderBy: { checkedAt: "desc" }, take: 30 } },
        orderBy: { createdAt: "desc" },
      },
      competitors: {
        include: { ranks: { orderBy: { checkedAt: "desc" }, take: 30 } },
        orderBy: { createdAt: "desc" },
      },
      healthReports: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!app) notFound();

  const report = app.healthReports[0];
  const keywordRefs = app.keywords.map((k) => ({ id: k.id, term: k.term, country: k.country }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <nav className="animate-fade-in-up flex items-center gap-1.5 text-sm text-muted mb-6">
        <Link href="/" className="hover:text-foreground">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground truncate">{app.name}</span>
      </nav>

      <div className="mb-6">
        <AppHeader
          id={app.id}
          name={app.name}
          iconUrl={app.iconUrl}
          platform={app.platform}
          developer={app.developer}
          url={app.url}
          rating={app.rating}
          ratingCount={app.ratingCount}
          version={app.version}
        />
      </div>

      <AppTabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: <Gauge className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-10">
                <section>
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-4">
                    <span className="h-4 w-1 rounded-full bg-accent" />
                    Health Report
                  </h2>
                  {report ? (
                    <HealthReportPanel
                      score={report.score}
                      breakdown={report.breakdown as unknown as HealthBreakdownItem[]}
                      suggestions={report.suggestions as unknown as HealthSuggestion[]}
                    />
                  ) : (
                    <div className="text-sm text-muted">No health report yet.</div>
                  )}
                </section>

                <section>
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-4">
                    <span className="h-4 w-1 rounded-full bg-accent" />
                    AI Copy Suggestions
                  </h2>
                  <AICopySuggestions appId={app.id} />
                </section>

                <section>
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-4">
                    <span className="h-4 w-1 rounded-full bg-accent" />
                    Screenshots <span className="text-muted font-normal">({app.screenshotUrls.length})</span>
                  </h2>
                  <div className="rounded-xl border border-border bg-card p-6">
                    <ScreenshotGallery urls={app.screenshotUrls} />
                  </div>
                </section>

                <section>
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-4">
                    <span className="h-4 w-1 rounded-full bg-accent" />
                    Product Health
                  </h2>
                  <ProductHealthChart appId={app.id} />
                </section>
              </div>
            ),
          },
          {
            id: "keywords",
            label: "Keywords",
            icon: <Tags className="h-3.5 w-3.5" />,
            badge: app.keywords.length,
            content: (
              <div className="space-y-10">
                <section>
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-4">
                    <span className="h-4 w-1 rounded-full bg-accent" />
                    Tracked Keywords <span className="text-muted font-normal">({app.keywords.length})</span>
                  </h2>
                  <KeywordsSection appId={app.id} platform={app.platform} keywords={app.keywords} />
                </section>

                <section>
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-4">
                    <span className="h-4 w-1 rounded-full bg-accent" />
                    Global Reach
                  </h2>
                  <GlobalReachSection appId={app.id} keywords={keywordRefs} />
                </section>
              </div>
            ),
          },
          {
            id: "competitors",
            label: "Competitors",
            icon: <Users className="h-3.5 w-3.5" />,
            badge: app.competitors.length,
            content: (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-4">
                  <span className="h-4 w-1 rounded-full bg-accent" />
                  Competitors <span className="text-muted font-normal">({app.competitors.length})</span>
                </h2>
                <CompetitorsSection
                  appId={app.id}
                  platform={app.platform}
                  competitors={app.competitors}
                  keywords={keywordRefs}
                />
              </section>
            ),
          },
          {
            id: "reviews",
            label: "Reviews",
            icon: <MessageSquare className="h-3.5 w-3.5" />,
            content: (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-4">
                  <span className="h-4 w-1 rounded-full bg-accent" />
                  Reviews
                </h2>
                <ReviewsSection appId={app.id} />
              </section>
            ),
          },
          {
            id: "localization",
            label: "Localization",
            icon: <Languages className="h-3.5 w-3.5" />,
            content: (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-4">
                  <span className="h-4 w-1 rounded-full bg-accent" />
                  Localization Health
                </h2>
                <LocalizationHealthSection appId={app.id} />
              </section>
            ),
          },
          {
            id: "discovery",
            label: "Discovery",
            icon: <Compass className="h-3.5 w-3.5" />,
            content: (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-4">
                  <span className="h-4 w-1 rounded-full bg-accent" />
                  Keyword Research
                </h2>
                <ResearchSection appId={app.id} />
              </section>
            ),
          },
          {
            id: "settings",
            label: "Settings",
            icon: <Settings className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-10">
                <section>
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-4">
                    <span className="h-4 w-1 rounded-full bg-accent" />
                    Integrations
                  </h2>
                  <PostHogSettings appId={app.id} />
                </section>

                <section>
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-4">
                    <span className="h-4 w-1 rounded-full bg-accent" />
                    Danger Zone
                  </h2>
                  <DangerZone appId={app.id} name={app.name} />
                </section>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
