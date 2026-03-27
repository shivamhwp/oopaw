import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  BookmarkSimpleIcon,
  BookOpenTextIcon,
  CalendarDotsIcon,
  CheckIcon,
  ClockIcon,
  CopySimpleIcon,
  CornersInIcon,
  CornersOutIcon,
  GlobeHemisphereWestIcon,
  SpinnerIcon,
  UserIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryKeys } from "@/lib/query/keys";
import type { ArticleViewMode, FeedItem } from "@/lib/types";
import { stripHtml } from "@/lib/feed/utils";
import { loadReaderArticle } from "@/lib/server/article";
import { useMediaQuery } from "@/lib/use-media-query";

type ReaderPaneProps = {
  item?: FeedItem;
  articleViewMode: ArticleViewMode;
  isBookmarked?: boolean;
  isBookmarkPending?: boolean;
  isFullScreen?: boolean;
  onBack?: () => void;
  onBookmarkToggle?: () => void;
  onRequireSignIn?: () => void;
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

const openExternalUrl = (url: string) => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "external noopener noreferrer";
  anchor.referrerPolicy = "no-referrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
};

export function ReaderPane({
  item,
  articleViewMode,
  isBookmarked = false,
  isBookmarkPending = false,
  isFullScreen = false,
  onBack,
  onBookmarkToggle,
  onRequireSignIn,
  onClose,
  onToggleFullScreen,
  onArticleViewModeChange,
}: ReaderPaneProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const resetCopyStateTimeoutRef = useRef<number | null>(null);
  const readerContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () => () => {
      if (resetCopyStateTimeoutRef.current) {
        window.clearTimeout(resetCopyStateTimeoutRef.current);
      }
    },
    [],
  );

  const readerArticleQuery = useQuery({
    queryKey: item ? queryKeys.readerArticle(item.id) : ["reader-article", "idle"],
    queryFn: async () => loadReaderArticle({ data: { item: item! } }),
    enabled: articleViewMode === "reader" && Boolean(item),
    staleTime: 1000 * 60 * 60 * 6,
    retry: 1,
  });
  const resolvedItem =
    item && readerArticleQuery.data
      ? {
          ...item,
          ...readerArticleQuery.data,
        }
      : item;
  const resolvedItemId = resolvedItem?.id;
  const resolvedItemContentHtml = resolvedItem?.contentHtml;
  const resetCopyState = () => {
    if (resetCopyStateTimeoutRef.current) {
      window.clearTimeout(resetCopyStateTimeoutRef.current);
    }

    resetCopyStateTimeoutRef.current = window.setTimeout(() => {
      setCopyState("idle");
      resetCopyStateTimeoutRef.current = null;
    }, 1800);
  };
  const handleCopyOriginalUrl = async () => {
    if (!resolvedItem) {
      return;
    }

    try {
      await navigator.clipboard.writeText(resolvedItem.url);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    resetCopyState();
  };

  useEffect(() => {
    if (!resolvedItemId) {
      return;
    }

    const container = readerContentRef.current;

    if (!container) {
      return;
    }

    const handleReaderContentClick = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) {
        return;
      }

      anchor.target = "_blank";
      anchor.rel = "external noopener noreferrer";

      if (!isMobile) {
        return;
      }

      event.preventDefault();
      openExternalUrl(anchor.href);
    };

    container.addEventListener("click", handleReaderContentClick);

    return () => {
      container.removeEventListener("click", handleReaderContentClick);
    };
  }, [isMobile, resolvedItemContentHtml, resolvedItemId]);

  if (!resolvedItem) return null;

  const isSiteMode = articleViewMode === "site";
  const isReaderLoading = articleViewMode === "reader" && readerArticleQuery.isPending;
  const showReaderHeader = (isMobile || isFullScreen) && !isReaderLoading;
  const title = resolvedItem.title;
  const author = resolvedItem.author;
  const date = formatDate(resolvedItem.publishedAt);
  const readerText = resolvedItem.contentText ?? stripHtml(resolvedItem.contentHtml);
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
          {!isMobile ? "Site" : null}
        </TabsTrigger>
        <TabsTrigger value="reader" aria-label="Reader mode" className="gap-1">
          <BookOpenTextIcon weight="duotone" className="size-4" aria-hidden="true" />
          {!isMobile ? "Reader" : null}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
  const topNav = (
    <div className="shrink-0 border-b border-border/40 bg-background/94 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:px-5 md:py-2">
        <div className="flex shrink-0 items-center">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              aria-label="Back to list"
            >
              <ArrowLeftIcon weight="bold" className="size-3" />
              <span className="hidden md:inline">Back to list</span>
            </Button>
          ) : (
            <div />
          )}
        </div>
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-9 w-9 cursor-pointer text-foreground hover:text-foreground/80"
            onClick={handleCopyOriginalUrl}
            aria-label={
              copyState === "copied"
                ? "Original article URL copied"
                : copyState === "error"
                  ? "Copy original article URL failed"
                  : "Copy original article URL"
            }
            title={
              copyState === "copied"
                ? "Copied"
                : copyState === "error"
                  ? "Copy failed"
                  : "Copy link"
            }
          >
            {copyState === "copied" ? (
              <CheckIcon weight="regular" className="size-4.5" />
            ) : (
              <CopySimpleIcon weight="regular" className="size-4.5" />
            )}
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="h-9 w-9 cursor-pointer text-foreground hover:text-foreground/80"
          >
            <a
              href={resolvedItem.url}
              target="_blank"
              rel="external noopener noreferrer"
              aria-label="Open original article"
              title="Open original"
            >
              <ArrowSquareOutIcon weight="regular" className="size-4.5" />
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-9 w-9 cursor-pointer text-foreground hover:text-foreground/80"
            disabled={(!onBookmarkToggle && !onRequireSignIn) || isBookmarkPending}
            onClick={onBookmarkToggle ?? onRequireSignIn}
            aria-label={
              onBookmarkToggle
                ? isBookmarked
                  ? "Remove bookmark"
                  : "Add bookmark"
                : "Sign in to bookmark"
            }
            title={
              onBookmarkToggle
                ? isBookmarked
                  ? "Remove bookmark"
                  : "Add bookmark"
                : "Sign in to bookmark"
            }
          >
            <BookmarkSimpleIcon weight={isBookmarked ? "fill" : "regular"} className="size-4.5" />
          </Button>
          {modeToggle}
          {onToggleFullScreen && !isMobile && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:text-primary/80"
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
    </div>
  );

  const content = (
    <div className="flex h-full flex-col bg-background">
      {topNav}
      {isSiteMode ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 md:px-5">
          <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-muted/20 p-6 text-left md:p-7">
            <div className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
              <GlobeHemisphereWestIcon weight="duotone" className="size-4" />
              Site view
            </div>

            <h3 className="mt-4 font-display text-2xl leading-tight text-foreground">
              Open the original page in a new tab
            </h3>

            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Site view now opens the article outside the app so links do not keep navigating inside
              an embedded frame.
            </p>

            <div className="mt-5">
              <Button type="button" onClick={() => openExternalUrl(resolvedItem.url)}>
                <ArrowSquareOutIcon weight="bold" className="size-4" />
                Open original article
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {showReaderHeader && (
            <div className="shrink-0 border-b border-border/40 px-4 pt-[env(safe-area-inset-top,0px)] pb-4 md:px-5 md:pt-5">
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
            ref={readerContentRef}
            className={
              isFullScreen
                ? "app-scroll-y pb-[env(safe-area-inset-bottom,0px)] flex-1 min-h-0 overflow-y-auto px-5 py-5 md:px-8 md:py-6"
                : "app-scroll-y pb-[env(safe-area-inset-bottom,0px)] flex-1 min-h-0 overflow-y-auto px-4 py-4 md:px-5 md:py-5"
            }
          >
            {isReaderLoading ? (
              <div className="flex min-h-full items-center justify-center">
                <div
                  role="status"
                  aria-label="Parsing article"
                  className="flex flex-col items-center gap-3 text-muted-foreground"
                >
                  <SpinnerIcon className="size-6 animate-spin" weight="bold" />
                  <span className="text-sm">Parsing article</span>
                </div>
              </div>
            ) : resolvedItem.contentHtml ? (
              <div className="mx-auto w-full max-w-[52rem]">
                <article
                  className="reader-prose select-text"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: resolvedItem.contentHtml }}
                />
              </div>
            ) : resolvedItem.contentText ? (
              <div className="mx-auto w-full max-w-[52rem]">
                <article className="reader-prose select-text whitespace-pre-wrap">
                  {resolvedItem.contentText}
                </article>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-[52rem]">
                <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-muted/25 p-5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <BookOpenTextIcon weight="fill" className="size-3.5" />
                    {readerArticleQuery.isLoading ? "Parsing article" : "Fallback mode"}
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {readerArticleQuery.isLoading
                      ? "Fetching the original page and extracting the article body."
                      : readerArticleQuery.error
                        ? readerArticleQuery.error instanceof Error
                          ? readerArticleQuery.error.message
                          : "This article could not be parsed right now. Open the original page for the complete story."
                        : "This feed does not include full article content. Open the original page for the complete story."}
                  </p>
                  {resolvedItem.excerpt && (
                    <p className="font-display text-xl leading-8 text-foreground">
                      {resolvedItem.excerpt}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  return content;
}
