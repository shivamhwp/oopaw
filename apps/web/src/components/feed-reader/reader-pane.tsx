import {
  ArrowLeft,
  ArrowSquareOut,
  BookOpenText,
  CalendarDots,
  Clock,
  CornersIn,
  CornersOut,
  GlobeHemisphereWest,
  SpinnerIcon,
  User,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ArticleEmbedStatus, ArticleViewMode, FeedItem, ReaderArticle } from "@/lib/types";

type ReaderPaneProps = {
  item?: FeedItem;
  article?: ReaderArticle;
  articleEmbed?: ArticleEmbedStatus;
  articleViewMode: ArticleViewMode;
  isLoadingArticle: boolean;
  isLoadingEmbed: boolean;
  isFullScreen?: boolean;
  onBack?: () => void;
  onClose?: () => void;
  onToggleFullScreen?: () => void;
  onArticleViewModeChange: (mode: ArticleViewMode) => void;
};

const formatDate = (value: string | undefined) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : undefined;

export function ReaderPane({
  item,
  article,
  articleEmbed,
  articleViewMode,
  isLoadingArticle,
  isLoadingEmbed,
  isFullScreen = false,
  onBack,
  onClose,
  onToggleFullScreen,
  onArticleViewModeChange,
}: ReaderPaneProps) {
  if (!item) return null;

  const isSiteMode = articleViewMode === "site";
  const isBlockedFromEmbed = articleEmbed?.canEmbed === false;
  const siteUrl = articleEmbed?.url === item.url ? (articleEmbed.finalUrl ?? item.url) : item.url;
  const title = article?.title ?? item.title;
  const author = article?.byline ?? item.author;
  const date = formatDate(article?.publishedAt ?? item.publishedAt);
  const modeToggle = (
    <Tabs
      value={articleViewMode}
      onValueChange={(value) => onArticleViewModeChange(value as ArticleViewMode)}
      className="reader-mode-tabs"
    >
      <TabsList aria-label="Article view mode">
        <TabsTrigger value="site">Site view</TabsTrigger>
        <TabsTrigger value="reader">Reader mode</TabsTrigger>
      </TabsList>
    </Tabs>
  );
  const topNav = (
    <div className="reader-topnav">
      <div className="flex min-w-0 items-center gap-2">
        {onBack ? (
          <button type="button" onClick={onBack} className="reader-topnav-back">
            <ArrowLeft weight="bold" className="size-3" />
            Back to list
          </button>
        ) : (
          <div />
        )}
      </div>
      <div className="flex items-center gap-2">
        {modeToggle}
        {onToggleFullScreen && (
          <button
            type="button"
            onClick={onToggleFullScreen}
            className="reader-topnav-icon"
            aria-label={isFullScreen ? "Exit full screen" : "Full screen"}
          >
            {isFullScreen ? (
              <CornersIn weight="bold" className="size-3.5" />
            ) : (
              <CornersOut weight="bold" className="size-3.5" />
            )}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="reader-topnav-icon"
            aria-label="Close reader"
          >
            <X weight="bold" className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full flex-col bg-background">
      {topNav}
      {isSiteMode ? (
        <>
          {!isBlockedFromEmbed ? (
            <div className="reader-site-frame-shell">
              <iframe
                key={siteUrl}
                title={`Original article: ${title}`}
                src={siteUrl}
                className="reader-site-frame"
              />
              {isLoadingEmbed && (
                <div className="reader-site-loading pointer-events-none absolute inset-0">
                  <SpinnerIcon className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          ) : (
            <div className="reader-site-fallback-wrap">
              <div className="reader-site-fallback paper-panel ink-ring">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <GlobeHemisphereWest weight="duotone" className="size-3.5" />
                  Site preview unavailable
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  {articleEmbed?.blockedReason ??
                    "This site could not be embedded inside the app panel."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    onClick={() => onArticleViewModeChange("reader")}
                  >
                    Use reader mode
                  </Button>
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <ArrowSquareOut weight="bold" />
                      Open original
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Header */}
          <div className="shrink-0 border-b border-border/40 px-5 pb-4 pt-5">
            <h2
              className={
                isFullScreen
                  ? "font-display text-[2.4rem] leading-tight text-pretty text-foreground"
                  : "font-display text-[1.85rem] leading-tight text-pretty text-foreground"
              }
            >
              {title}
            </h2>

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {author && (
                <span className="inline-flex items-center gap-1">
                  <User weight="fill" className="size-3" />
                  {author}
                </span>
              )}
              {date && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDots weight="fill" className="size-3" />
                  {date}
                </span>
              )}
              {article?.readTimeMinutes && (
                <span className="inline-flex items-center gap-1">
                  <Clock weight="fill" className="size-3" />
                  {article.readTimeMinutes} min read
                </span>
              )}
            </div>

            <div className="mt-4">
              <Button asChild variant="outline" size="sm" className="rounded-full h-7 text-xs">
                <a href={item.url} target="_blank" rel="noreferrer">
                  <ArrowSquareOut weight="bold" />
                  Open original
                </a>
              </Button>
            </div>
          </div>

          <div
            className={
              isFullScreen
                ? "flex-1 min-h-0 overflow-y-auto px-8 py-6 max-w-3xl mx-auto w-full"
                : "flex-1 min-h-0 overflow-y-auto px-5 py-5"
            }
          >
            {isLoadingArticle ? (
              <div className="reader-pane-loading">
                <SpinnerIcon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : article?.contentHtml ? (
              <article
                className="reader-prose"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: article.contentHtml }}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/25 p-5 space-y-3">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <BookOpenText weight="fill" className="size-3.5" />
                  Fallback mode
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  {article?.fallbackReason ??
                    "A clean in-app reader could not be generated for this page."}
                </p>
                {(article?.excerpt || item.excerpt) && (
                  <p className="font-display text-xl leading-8 text-foreground">
                    {article?.excerpt ?? item.excerpt}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
