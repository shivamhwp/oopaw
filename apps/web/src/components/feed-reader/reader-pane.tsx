import { useEffect, useRef, useState } from "react";
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

  useEffect(
    () => () => {
      if (resetCopyStateTimeoutRef.current) {
        window.clearTimeout(resetCopyStateTimeoutRef.current);
      }
    },
    [],
  );

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
    try {
      await navigator.clipboard.writeText(item.url);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    resetCopyState();
  };
  const modeToggle = (
    <Tabs
      className="w-full md:w-auto"
      value={articleViewMode}
      onValueChange={(value) => onArticleViewModeChange(value as ArticleViewMode)}
    >
      <TabsList
        aria-label="Article view mode"
        className="grid h-auto w-full grid-cols-2 md:inline-flex md:w-auto"
      >
        <TabsTrigger
          value="site"
          aria-label="Site view"
          className="gap-1 px-3 py-2 text-xs sm:text-sm"
        >
          <GlobeHemisphereWestIcon weight="duotone" className="size-4" aria-hidden="true" />
          Site
        </TabsTrigger>
        <TabsTrigger
          value="reader"
          aria-label="Reader mode"
          className="gap-1 px-3 py-2 text-xs sm:text-sm"
        >
          <BookOpenTextIcon weight="duotone" className="size-4" aria-hidden="true" />
          Reader
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
  const topNav = (
    <div className="flex flex-col gap-2 border-b border-border/40 bg-background/94 px-3 py-2 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm sm:px-4 md:flex-row md:items-center md:justify-between md:px-5 md:py-1">
      <div className="flex min-w-0 items-center justify-between gap-2 md:flex-1 md:justify-start">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
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
      <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end">
        <div className="order-2 flex flex-wrap items-center justify-end gap-2 md:order-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 hover:text-primary/80 sm:h-9 sm:w-9 md:h-8 md:w-8"
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
              <CheckIcon weight="bold" className="size-3.5" />
            ) : (
              <CopySimpleIcon weight="bold" className="size-3.5" />
            )}
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 hover:text-primary/80 sm:h-9 sm:w-9 md:h-8 md:w-8"
          >
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              aria-label="Open original article"
              title="Open original"
            >
              <ArrowSquareOutIcon weight="bold" className="size-3.5" />
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 hover:text-primary/80 sm:h-9 sm:w-9 md:h-8 md:w-8"
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
            <BookmarkSimpleIcon weight={isBookmarked ? "fill" : "regular"} className="size-3.5" />
          </Button>
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
              className="h-8 w-8 sm:h-9 sm:w-9 md:h-8 md:w-8"
              onClick={onClose}
              aria-label="Close reader"
            >
              <XIcon weight="bold" className="size-3.5" />
            </Button>
          )}
        </div>
        <div className="order-1 w-full md:order-2 md:w-auto">{modeToggle}</div>
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
