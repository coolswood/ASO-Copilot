import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  ChevronRight,
  Compass,
  Gauge,
  Languages,
  Loader2,
  MessageSquare,
  Settings,
  Tags,
  Users,
} from "lucide-react";
import HealthReportPanel from "@/components/HealthReportPanel";
import AICopySuggestions from "@/components/AICopySuggestions";
import KeywordsSection from "@/components/KeywordsSection";
import CompetitorsSection from "@/components/CompetitorsSection";
import ResearchSection from "@/components/ResearchSection";
import GlobalReachSection from "@/components/GlobalReachSection";
import AppHeader from "@/components/AppHeader";
import CountrySelect from "@/components/CountrySelect";
import ScreenshotGallery from "@/components/ScreenshotGallery";
import ReviewsSection from "@/components/ReviewsSection";
import ProductHealthChart from "@/components/ProductHealthChart";
import PostHogSettings from "@/components/PostHogSettings";
import DangerZone from "@/components/DangerZone";
import AppTabs from "@/components/AppTabs";
import LocalizationHealthSection from "@/components/LocalizationHealthSection";
import { parseCountryParam } from "@/lib/countryParam";
import type { HealthBreakdownItem, HealthSuggestion } from "@/lib/health";
import type { StorePlatform } from "@/lib/stores/types";

/** Shape returned by GET /api/apps/:id — identical to the old server
 * component's Prisma include-query (JSON-serialized: dates arrive as ISO
 * strings). */
interface AppDetailKeyword {
  id: string;
  term: string;
  country: string;
  volume: number | null;
  difficulty: number | null;
  ranks: { position: number | null; checkedAt: string }[];
}

interface AppDetailCompetitor {
  id: string;
  storeId: string;
  name: string;
  iconUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  ranks: { keywordId: string; position: number | null; checkedAt: string }[];
}

interface AppDetail {
  id: string;
  name: string;
  iconUrl: string | null;
  platform: StorePlatform;
  developer: string | null;
  url: string | null;
  rating: number | null;
  ratingCount: number | null;
  version: string | null;
  /** Home storefront - the fallback for the global country selector. */
  country: string;
  screenshotUrls: string[];
  keywords: AppDetailKeyword[];
  competitors: AppDetailCompetitor[];
  healthReports: {
    score: number;
    breakdown: unknown;
    suggestions: unknown;
  }[];
}

export default function AppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [app, setApp] = useState<AppDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Unfiltered keyword refs for Global Reach - its cross-country scanner is
  // deliberately not scoped to the selected storefront, unlike the sections.
  const [allKeywordRefs, setAllKeywordRefs] = useState<{ id: string; term: string }[]>([]);

  // Global storefront selector: the URL ?country= param is the source of
  // truth (normalized once here so an invalid value can't cause fetch loops).
  // Fallback chain: URL param -> the app's home country (once loaded) -> "us".
  const paramCountry = parseCountryParam(searchParams.get("country"));
  const country = paramCountry ?? parseCountryParam(app?.country) ?? "us";

  function selectCountry(next: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set("country", next);
        return params;
      },
      { replace: true },
    );
  }

  const loadApp = useCallback(async () => {
    if (!id) return;
    try {
      const [res, refsRes] = await Promise.all([
        fetch(`/api/apps/${id}?country=${country}`),
        fetch(`/api/apps/${id}/keywords`),
      ]);
      if (!res.ok) throw new Error("Not found");
      const data: { app: AppDetail } = await res.json();
      setApp(data.app);
      if (refsRes.ok) {
        const refsData: { keywords: { id: string; term: string }[] } = await refsRes.json();
        setAllKeywordRefs(refsData.keywords.map((k) => ({ id: k.id, term: k.term })));
      }
      setNotFound(false);
    } catch {
      setNotFound(true);
    }
  }, [id, country]);

  useEffect(() => {
    setApp(null);
    setNotFound(false);
    loadApp();
  }, [loadApp]);

  if (notFound) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
        <div className="text-lg font-semibold tracking-tight">App not found</div>
        <div className="text-sm text-muted">
          <Link to="/" className="text-accent font-medium hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  const report = app.healthReports[0];
  const keywordRefs = app.keywords.map((k) => ({ id: k.id, term: k.term, country: k.country }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <nav className="animate-fade-in-up flex items-center gap-1.5 text-sm text-muted mb-6">
        <Link to="/" className="hover:text-foreground">
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
          onSynced={loadApp}
          actions={
            <CountrySelect
              value={country}
              onChange={selectCountry}
              title="Storefront - keywords, competitors, reviews and research below are scoped to this market"
            />
          }
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
                    Screenshots{" "}
                    <span className="text-muted font-normal">({app.screenshotUrls.length})</span>
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
                    Tracked Keywords{" "}
                    <span className="text-muted font-normal">({app.keywords.length})</span>
                  </h2>
                  <KeywordsSection
                    appId={app.id}
                    platform={app.platform}
                    country={country}
                    keywords={app.keywords}
                    onChanged={loadApp}
                  />
                </section>

                <section>
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight mb-4">
                    <span className="h-4 w-1 rounded-full bg-accent" />
                    Global Reach
                  </h2>
                  <GlobalReachSection appId={app.id} keywords={allKeywordRefs} />
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
                  Competitors{" "}
                  <span className="text-muted font-normal">({app.competitors.length})</span>
                </h2>
                <CompetitorsSection
                  appId={app.id}
                  platform={app.platform}
                  country={country}
                  competitors={app.competitors}
                  keywords={keywordRefs}
                  onChanged={loadApp}
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
                <ReviewsSection appId={app.id} country={country} />
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
                <ResearchSection appId={app.id} country={country} onChanged={loadApp} />
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
