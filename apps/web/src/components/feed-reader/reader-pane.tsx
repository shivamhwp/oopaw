import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  BookOpenTextIcon,
  CalendarDotsIcon,
  ClockIcon,
  CornersInIcon,
  CornersOutIcon,
  GlobeHemisphereWestIcon,
  UserIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ArticleViewMode, FeedItem } from "@/lib/types";
import { stripHtml } from "@/lib/feed/utils";
import { useMediaQuery } from "@/lib/use-media-query";

type ReaderPaneProps = {
  item?: FeedItem;
  articleViewMode: ArticleViewMode;
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
  articleViewMode,
  isFullScreen = false,
  onBack,
  onClose,
  onToggleFullScreen,
  onArticleViewModeChange,
}: ReaderPaneProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (!item) return null;

  const isSiteMode = articleViewMode === "site";
  const showReaderHeader = isMobile || isFullScreen;
  const title = item.title;
  const author = item.author;
  const date = formatDate(item.publishedAt);
  const readerText = item.contentText ?? stripHtml(item.contentHtml);
  const readTimeMinutes = readerText
    ? Math.max(1, Math.ceil(readerText.split(/\s+/).length / 220))
    : undefined;
  const modeToggle = (
    <Tabs
      value={articleViewMode}
      onValueChange={(value) => onArticleViewModeChange(value as ArticleViewMode)}
    >
      <TabsList aria-label="Article view mode">
        <TabsTrigger value="site" aria-label="Site view" className="gap-1">
          <GlobeHemisphereWestIcon weight="duotone" className="size-4" aria-hidden="true" />
          Site
        </TabsTrigger>
        <TabsTrigger value="reader" aria-label="Reader mode" className="gap-1">
          <BookOpenTextIcon weight="duotone" className="size-4" aria-hidden="true" />
          Reader
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
  const topNav = (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 bg-background/94 px-4 py-2 backdrop-blur-sm md:flex-nowrap md:items-center md:px-5 md:py-1 pt-[env(safe-area-inset-top,0px)]">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            aria-label="Back to list"
          >
            <ArrowLeftIcon weight="bold" className="size-3" />
            <span className="min-[420px]:hidden">Back</span>
            <span className="hidden min-[420px]:inline">Back to list</span>
          </Button>
        ) : (
          <div />
        )}
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto md:flex-nowrap">
        <Button asChild variant="ghost" size="sm">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            aria-label="Open original article"
          >
            <ArrowSquareOutIcon weight="bold" className="size-3.5" />
            <span>Open original</span>
          </a>
        </Button>
        {modeToggle}
        {onToggleFullScreen && !isMobile && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleFullScreen}
            aria-label={isFullScreen ? "Exit full screen" : "Full screen"}
          >
            {isFullScreen ? (
              <CornersInIcon weight="bold" className="size-3.5" />
            ) : (
              <CornersOutIcon weight="bold" className="size-3.5" />
            )}
          </Button>
        )}
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close reader"
          >
            <XIcon weight="bold" className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-background">
      {topNav}
      {isSiteMode ? (
        <>
          <div className="h-full w-full">
            <iframe
              key={item.url}
              title={`Original article: ${title}`}
              src={item.url}
              className="h-full w-full border-0 bg-background"
            />
          </div>
          <div className="border-t border-border/40 px-4 py-3 text-sm text-muted-foreground md:px-5">
            If this page does not load in the panel, open the original article in a new tab.
          </div>
        </>
      ) : (
        <>
          {showReaderHeader && (
            <div className="pt-[env(safe-area-inset-top,0px)] shrink-0 border-b border-border/40 px-4 pb-4 pt-4 md:px-5 md:pt-5">
              <div className="mx-auto w-full max-w-[52rem]">
                <h2
                  className={
                    isMobile
                      ? "font-display text-[1.5rem] leading-tight text-pretty text-foreground"
                      : "font-display text-[2.4rem] leading-tight text-pretty text-foreground"
                  }
                >
                  {title}
                </h2>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {author && (
                    <span className="inline-flex items-center gap-1">
                      <UserIcon weight="fill" className="size-3" />
                      {author}
                    </span>
                  )}
                  {date && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDotsIcon weight="fill" className="size-3" />
                      {date}
                    </span>
                  )}
                  {readTimeMinutes && (
                    <span className="inline-flex items-center gap-1">
                      <ClockIcon weight="fill" className="size-3" />
                      {readTimeMinutes} min read
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div
            className={
              isFullScreen
                ? "pb-[env(safe-area-inset-bottom,0px)] flex-1 min-h-0 overflow-y-auto px-5 py-5 md:px-8 md:py-6"
                : "pb-[env(safe-area-inset-bottom,0px)] flex-1 min-h-0 overflow-y-auto px-4 py-4 md:px-5 md:py-5"
            }
          >
            {item.contentHtml ? (
              <div className="mx-auto w-full max-w-[52rem]">
                <article
                  className="reader-prose"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: item.contentHtml }}
                />
              </div>
            ) : item.contentText ? (
              <div className="mx-auto w-full max-w-[52rem]">
                <article className="reader-prose whitespace-pre-wrap">{item.contentText}</article>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-[52rem]">
                <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-muted/25 p-5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <BookOpenTextIcon weight="fill" className="size-3.5" />
                    Fallback mode
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground">
                    This feed does not include full article content. Open the original page for the
                    complete story.
                  </p>
                  {item.excerpt && (
                    <p className="font-display text-xl leading-8 text-foreground">{item.excerpt}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
