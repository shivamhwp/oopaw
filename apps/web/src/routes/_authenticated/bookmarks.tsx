import { useEffect, useRef, useState } from "react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { useConvexAuth, useQuery as useConvexQuery } from "convex/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import { CowIcon, SpinnerIcon, TrashIcon } from "@phosphor-icons/react";
import { type PanelImperativeHandle } from "react-resizable-panels";
import { AppNavbar } from "@/components/feed-reader/feed-reader-app";
import { ReaderPane } from "@/components/feed-reader/reader-pane";
import {
  closeBookmarkPanelAtom,
  currentBookmarksAtom,
  MAX_FEED_READER_PANEL_SIZE,
  MIN_FEED_READER_READER_PANEL_SIZE,
  openBookmarkAtom,
  setCurrentBlogViewModeAtom,
} from "@/components/feed-reader/store";
import { useFeedReader } from "@/components/feed-reader/use-feed-reader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { api } from "@/lib/convex";
import type { FeedItem } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

const formatSavedDate = (value: number) =>
  new Date(value).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });

const getBookmarkSourceLabel = (bookmark: {
  sourceLabel?: string;
  sourceSiteUrl?: string;
  url: string;
}) => {
  if (bookmark.sourceLabel) {
    return bookmark.sourceLabel.replace(/\s+rss\s+feed$/i, "");
  }

  try {
    return new URL(bookmark.sourceSiteUrl ?? bookmark.url).hostname.replace(/^www\./, "");
  } catch {
    return "Saved link";
  }
};

const toBookmarkItem = (bookmark: {
  _id: string;
  excerpt?: string;
  imageUrl?: string;
  publishedAt?: string;
  title: string;
  url: string;
}) =>
  ({
    id: bookmark._id,
    sourceId: bookmark._id,
    url: bookmark.url,
    title: bookmark.title,
    excerpt: bookmark.excerpt,
    contentHtml: undefined,
    contentText: undefined,
    publishedAt: bookmark.publishedAt,
    author: undefined,
    imageUrl: bookmark.imageUrl,
    isNew: false,
    isRead: true,
  }) satisfies FeedItem;

export const Route = createFileRoute("/_authenticated/bookmarks")({
  component: BookmarksRoute,
});

function BookmarksRoute() {
  const navigate = useNavigate({ from: "/bookmarks" });
  const convexAuth = useConvexAuth();
  const canReadBookmarks = !convexAuth.isLoading && convexAuth.isAuthenticated;
  const currentBookmarks = useAtomValue(currentBookmarksAtom);
  const openBookmark = useSetAtom(openBookmarkAtom);
  const closeBookmarkPanel = useSetAtom(closeBookmarkPanelAtom);
  const setCurrentBlogViewMode = useSetAtom(setCurrentBlogViewModeAtom);
  const bookmarks = useConvexQuery(
    api.bookmarks.queries.listForCurrentUser,
    canReadBookmarks ? {} : "skip",
  );
  const hasBookmarksLoaded = !convexAuth.isLoading && bookmarks !== undefined;
  const {
    isPreferencesPending,
    isSignedIn,
    preferences,
    setDefaultArticleViewMode,
    setPollingIntervalMinutes,
  } = useFeedReader();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const detailPanelRef = useRef<PanelImperativeHandle>(null);
  const [detailPanelSize, setDetailPanelSize] = useState(MIN_FEED_READER_READER_PANEL_SIZE);
  const [isReaderFullScreen, setIsReaderFullScreen] = useState(false);
  const toggleBookmark = useConvexMutation(api.bookmarks.mutations.toggleForCurrentUser);
  const bookmarkMutation = useMutation({ mutationFn: toggleBookmark });
  const selectedBookmarkId =
    currentBookmarks.panel === "reader" ? currentBookmarks.bookmarkId : null;
  const hasSelectedBookmark =
    selectedBookmarkId !== null &&
    bookmarks?.some((bookmark) => bookmark._id === selectedBookmarkId) === true;
  const selectedBookmark =
    bookmarks?.find((bookmark) => bookmark._id === selectedBookmarkId) ?? null;
  const selectedItem = selectedBookmark ? toBookmarkItem(selectedBookmark) : undefined;
  const isDetailPanelOpen = Boolean(selectedBookmarkId);
  const selectedBookmarkView =
    currentBookmarks.panel === "reader" ? currentBookmarks.blogViewMode : preferences.defaultView;

  useEffect(() => {
    if (isMobile || !detailPanelRef.current) {
      return;
    }

    if (isDetailPanelOpen) {
      detailPanelRef.current.resize(`${detailPanelSize}%`);
      return;
    }

    detailPanelRef.current.collapse();
    setIsReaderFullScreen(false);
  }, [detailPanelSize, isDetailPanelOpen, isMobile]);

  useEffect(() => {
    if (selectedBookmarkId && !hasSelectedBookmark && !bookmarkMutation.isPending) {
      closeBookmarkPanel();
    }
  }, [bookmarkMutation.isPending, closeBookmarkPanel, hasSelectedBookmark, selectedBookmarkId]);

  const handleRemoveBookmark = async (bookmark: NonNullable<typeof bookmarks>[number]) => {
    await bookmarkMutation.mutateAsync({
      url: bookmark.url,
      title: bookmark.title,
      excerpt: bookmark.excerpt,
      imageUrl: bookmark.imageUrl,
      sourceLabel: bookmark.sourceLabel,
      sourceSiteUrl: bookmark.sourceSiteUrl,
      publishedAt: bookmark.publishedAt,
    });

    if (bookmark._id === selectedBookmarkId) {
      closeBookmarkPanel();
    }
  };

  const handleOpenBookmark = (bookmarkId: string) => {
    openBookmark({
      bookmarkId,
      defaultView: preferences.defaultView,
    });
  };

  const bookmarkGrid = (
    <div
      className={cn(
        "app-scroll-y h-full min-w-0 overflow-y-auto",
        isMobile ? "px-4 py-4 sm:px-5 sm:py-5" : "px-6 py-6",
      )}
      data-scroll-restoration-id="bookmarks-grid"
    >
      {!hasBookmarksLoaded ? (
        <div className="flex h-full min-h-[18rem] items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SpinnerIcon className="size-4 animate-spin" weight="bold" />
            <span>Loading bookmarks…</span>
          </div>
        </div>
      ) : (bookmarks?.length ?? 0) === 0 ? (
        <div className="flex h-full min-h-[18rem] items-center justify-center">
          <div className="max-w-xs text-center text-muted-foreground">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CowIcon weight="regular" className="size-7" />
            </div>
            <p className="text-xl">no bookmarks yet !!</p>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            isMobile
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-[repeat(auto-fill,minmax(18rem,18rem))] justify-start",
          )}
        >
          {bookmarks?.map((bookmark) => {
            const isSelected = bookmark._id === selectedBookmarkId;
            const isRemovingSelectedBookmark =
              bookmarkMutation.isPending && bookmarkMutation.variables?.url === bookmark.url;
            const sourceLabel = getBookmarkSourceLabel(bookmark);

            return (
              <div key={bookmark._id} className="group relative min-h-[13rem] md:h-[13rem]">
                <Card
                  tabIndex={0}
                  onClick={() => handleOpenBookmark(bookmark._id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleOpenBookmark(bookmark._id);
                    }
                  }}
                  className={cn(
                    "h-full cursor-pointer gap-0 py-0 pr-14 transition-colors duration-150 md:pr-0",
                    isSelected ? "bg-primary/[0.02] ring-primary/40" : "hover:bg-muted/30",
                  )}
                >
                  <CardContent className="flex h-full flex-col justify-between px-4 pt-4 pb-3">
                    <p className="line-clamp-4 text-ellipsis font-display text-[1.05rem] leading-snug text-foreground">
                      {bookmark.title}
                    </p>
                  </CardContent>

                  <CardFooter className="flex flex-col items-start gap-0.5 px-4 py-3">
                    <p className="w-full truncate text-[0.72rem] text-muted-foreground">
                      {sourceLabel}
                    </p>
                    <p className="text-[0.72rem] text-muted-foreground">
                      Saved {formatSavedDate(bookmark.bookmarkedAt)}
                    </p>
                  </CardFooter>
                </Card>

                <div className="absolute right-3 top-3 z-10 flex gap-1 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="h-6 w-6 rounded-lg border border-border/60 bg-card text-destructive hover:bg-muted hover:text-destructive"
                    disabled={bookmarkMutation.isPending}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleRemoveBookmark(bookmark);
                    }}
                    aria-label={`Remove ${bookmark.title} from bookmarks`}
                  >
                    {isRemovingSelectedBookmark ? (
                      <SpinnerIcon className="size-3 animate-spin" weight="bold" />
                    ) : (
                      <TrashIcon className="size-3" weight="bold" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const detailPanelContent = (
    <div className="h-full min-w-0 overflow-hidden md:pl-2">
      <ReaderPane
        item={selectedItem}
        articleViewMode={selectedBookmarkView}
        isBookmarked={true}
        isBookmarkPending={bookmarkMutation.isPending}
        isFullScreen={false}
        onBack={() => closeBookmarkPanel()}
        onBookmarkToggle={
          selectedBookmark ? () => void handleRemoveBookmark(selectedBookmark) : undefined
        }
        onClose={() => closeBookmarkPanel()}
        onToggleFullScreen={() => setIsReaderFullScreen((value) => !value)}
        onArticleViewModeChange={(view) =>
          setCurrentBlogViewMode({ route: "bookmarks", mode: view })
        }
      />
    </div>
  );

  return (
    <>
      <div className="flex h-svh min-h-svh flex-col overflow-hidden bg-background">
        <AppNavbar
          isPreferencesPending={isPreferencesPending}
          isSignedIn={isSignedIn}
          isRefreshingAll={false}
          onBookmarksClick={() => void navigate({ to: "/bookmarks" })}
          onDefaultViewChange={setDefaultArticleViewMode}
          onPollingIntervalMinutesChange={setPollingIntervalMinutes}
          onRefreshAll={() => {}}
          onSignIn={() => {}}
          pollingIntervalMinutes={preferences.pollingIntervalMinutes}
          defaultView={preferences.defaultView}
        />

        {isMobile ? (
          <div className="flex-1 min-h-0">{bookmarkGrid}</div>
        ) : (
          <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0 min-w-0">
            <ResizablePanel defaultSize="100%" minSize="30%" className="min-w-0">
              {bookmarkGrid}
            </ResizablePanel>

            <ResizableHandle
              withHandle
              className={cn(
                "cursor-col-resize",
                !isDetailPanelOpen && "invisible pointer-events-none",
              )}
            />

            <ResizablePanel
              className="min-w-0"
              panelRef={detailPanelRef}
              collapsible
              collapsedSize="0%"
              defaultSize="0%"
              minSize={`${MIN_FEED_READER_READER_PANEL_SIZE}%`}
              maxSize={`${MAX_FEED_READER_PANEL_SIZE}%`}
              onResize={(size) => {
                if (size.asPercentage === 0 && isDetailPanelOpen) {
                  closeBookmarkPanel();
                  return;
                }

                if (size.asPercentage > 0 && size.asPercentage !== detailPanelSize) {
                  setDetailPanelSize(size.asPercentage);
                }
              }}
            >
              {detailPanelContent}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      {isMobile && isDetailPanelOpen && (
        <div className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
          {detailPanelContent}
        </div>
      )}

      {!isMobile && isReaderFullScreen && selectedItem && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background">
          <ReaderPane
            item={selectedItem}
            articleViewMode={selectedBookmarkView}
            isBookmarked={true}
            isBookmarkPending={bookmarkMutation.isPending}
            isFullScreen={true}
            onBack={() => closeBookmarkPanel()}
            onBookmarkToggle={
              selectedBookmark ? () => void handleRemoveBookmark(selectedBookmark) : undefined
            }
            onClose={() => closeBookmarkPanel()}
            onToggleFullScreen={() => setIsReaderFullScreen((value) => !value)}
            onArticleViewModeChange={(view) =>
              setCurrentBlogViewMode({ route: "bookmarks", mode: view })
            }
          />
        </div>
      )}
    </>
  );
}
