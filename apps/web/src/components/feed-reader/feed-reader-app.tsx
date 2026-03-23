import { useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import {
  ArrowClockwiseIcon,
  CowIcon,
  DesktopIcon,
  EyeIcon,
  EyeSlashIcon,
  MoonIcon,
  PhoneCallIcon,
  PlusIcon,
  SignOutIcon,
  SlidersHorizontalIcon,
  SpinnerIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { useHotkey, useHotkeySequence } from "@tanstack/react-hotkeys";
import { useQueryClient } from "@tanstack/react-query";
import { useConvexAuth } from "convex/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAtom, useSetAtom } from "jotai";
import { type PanelImperativeHandle } from "react-resizable-panels";
import { ItemList } from "@/components/feed-reader/item-list";
import { ReaderPane } from "@/components/feed-reader/reader-pane";
import { SourceForm } from "@/components/feed-reader/source-form";
import {
  detailPanelSizeAtom,
  itemListScrollAtom,
  MAX_FEED_READER_PANEL_SIZE,
  MIN_FEED_READER_LIST_PANEL_SIZE,
  MIN_FEED_READER_READER_PANEL_SIZE,
  setItemListScrollAtom,
  type DetailPanelState,
} from "@/components/feed-reader/store";
import { SourceGrid } from "@/components/feed-reader/source-grid";
import { useFeedReader } from "@/components/feed-reader/use-feed-reader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme-provider";
import { api } from "@/lib/convex";
import type { ArticleViewMode } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

const getDetailPanelMinSize = (detailPanel: DetailPanelState) =>
  detailPanel.mode === "list" ? MIN_FEED_READER_LIST_PANEL_SIZE : MIN_FEED_READER_READER_PANEL_SIZE;

const getDetailPanelOpenSize = (detailPanel: DetailPanelState, detailPanelSize: number) =>
  Math.max(detailPanelSize, getDetailPanelMinSize(detailPanel));

const THEME_CYCLE = [
  { value: "system" as const, label: "System", Icon: DesktopIcon },
  { value: "light" as const, label: "Light", Icon: SunIcon },
  { value: "dark" as const, label: "Dark", Icon: MoonIcon },
];
type ThemeValue = (typeof THEME_CYCLE)[number]["value"];

const articleViewOptions: ArticleViewMode[] = ["reader", "site"];
const pollingOptions = [
  { label: "10", value: 10 },
  { label: "15", value: 15 },
  { label: "30", value: 30 },
  { label: "60", value: 60 },
];
const AUTH_LOADING_NAME = "Tyler Durden";
const AUTH_LOADING_EMAIL = "FMCRec@telnex.com";

const getCurrentHref = () =>
  typeof window === "undefined"
    ? "/"
    : `${window.location.pathname}${window.location.search}${window.location.hash}`;

const getUserDisplayName = (user: ReturnType<typeof useUser>["user"]) =>
  user?.fullName ?? user?.firstName ?? user?.username ?? "Profile";

const getUserEmail = (user: ReturnType<typeof useUser>["user"]) =>
  user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? "";

const isEditableElement = (element: Element | null) =>
  element instanceof HTMLElement &&
  (element.isContentEditable ||
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT");

function ProfileMenu({
  defaultView,
  isSavingPreferences,
  isRefreshingAll,
  pollingIntervalMinutes,
  onDefaultViewChange,
  onPollingIntervalMinutesChange,
  onRefreshAll,
  onSignIn,
}: {
  defaultView: ArticleViewMode;
  isSavingPreferences: boolean;
  isRefreshingAll: boolean;
  pollingIntervalMinutes: number;
  onDefaultViewChange: (mode: ArticleViewMode) => Promise<void>;
  onPollingIntervalMinutesChange: (minutes: number) => Promise<void>;
  onRefreshAll: () => void;
  onSignIn: () => void;
}) {
  const clerk = useClerk();
  const { user, isLoaded: isAuthLoaded, isSignedIn } = useUser();
  const { theme, setTheme } = useTheme();
  const displayName = getUserDisplayName(user);
  const email = getUserEmail(user);
  const [isEmailVisible, setIsEmailVisible] = useState(false);
  const EmailVisibilityIcon = isEmailVisible ? EyeSlashIcon : EyeIcon;
  const areMenuControlsDisabled = !isAuthLoaded || isSavingPreferences;
  const shouldShowProfileSection = isSignedIn || !isAuthLoaded;
  const profileName = isAuthLoaded && isSignedIn ? displayName : AUTH_LOADING_NAME;
  const profileEmail = isAuthLoaded && isSignedIn ? email : AUTH_LOADING_EMAIL;
  const profileInitials = profileName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="icon" aria-label="Open settings">
          <SlidersHorizontalIcon weight="bold" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[16rem]">
        {shouldShowProfileSection ? (
          <>
            <div className="flex items-start gap-3 px-2.5 py-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                {profileInitials}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium text-foreground">{profileName}</p>
                <div className="flex items-center gap-1.5">
                  <p
                    className={cn(
                      "min-w-0 flex-1 truncate text-xs text-muted-foreground transition-all",
                      isAuthLoaded && isSignedIn && !isEmailVisible && "blur-sm",
                    )}
                  >
                    {profileEmail}
                  </p>
                  {isAuthLoaded && isSignedIn && email ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 rounded-md"
                      onClick={() => setIsEmailVisible((current) => !current)}
                      aria-label={isEmailVisible ? "Hide email" : "Show email"}
                    >
                      <EmailVisibilityIcon weight="bold" className="size-4" />
                    </Button>
                  ) : (
                    <div className="size-7 shrink-0" aria-hidden="true" />
                  )}
                </div>
              </div>
            </div>

            <DropdownMenuSeparator />
          </>
        ) : null}

        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <div className="px-1.5 pb-1">
          <Tabs
            value={theme}
            onValueChange={(value) => setTheme(value as ThemeValue)}
            className="gap-0"
          >
            <TabsList className="grid h-auto w-full grid-cols-3">
              {THEME_CYCLE.map(({ value, label, Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="flex w-full min-w-0 gap-1.5 px-2 py-2 text-xs sm:min-w-0 sm:flex-1"
                  disabled={areMenuControlsDisabled}
                >
                  <Icon weight="bold" className="size-3.5" />
                  <span>{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Polling</DropdownMenuLabel>
        <div className="px-1.5 pb-1">
          <Tabs
            value={String(pollingIntervalMinutes)}
            onValueChange={(value) => void onPollingIntervalMinutesChange(Number(value))}
            className="gap-0"
          >
            <TabsList className="grid h-auto w-full grid-cols-4">
              {pollingOptions.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={String(option.value)}
                  className="w-full min-w-0 px-2 py-2 text-xs sm:min-w-0 sm:flex-1"
                  disabled={areMenuControlsDisabled}
                >
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Article View</DropdownMenuLabel>
        <div className="px-1.5 pb-1">
          <Tabs
            value={defaultView}
            onValueChange={(value) => void onDefaultViewChange(value as ArticleViewMode)}
            className="gap-0"
          >
            <TabsList className="grid h-auto w-full grid-cols-2">
              {articleViewOptions.map((view) => (
                <TabsTrigger
                  key={view}
                  value={view}
                  className="w-full min-w-0 px-3 py-2 text-xs capitalize sm:min-w-0 sm:flex-1"
                  disabled={areMenuControlsDisabled}
                >
                  {view}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <DropdownMenuSeparator />

        <div className="space-y-1.5 p-1.5">
          {!isAuthLoaded ? (
            <Button
              type="button"
              variant="ghost"
              size="default"
              className="w-full cursor-default justify-start rounded-lg text-sm text-muted-foreground"
              disabled
            >
              <PhoneCallIcon weight="bold" className="size-3.5" />
              On call with auth offices.
            </Button>
          ) : !isSignedIn ? (
            <Button
              type="button"
              variant="ghost"
              size="default"
              className="w-full cursor-pointer justify-start rounded-lg text-sm text-muted-foreground"
              onClick={onSignIn}
            >
              Sign in
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="default"
            className="w-full cursor-pointer justify-start rounded-lg text-sm text-muted-foreground"
            onClick={onRefreshAll}
            disabled={!isAuthLoaded || isRefreshingAll}
          >
            <ArrowClockwiseIcon
              weight="bold"
              className={cn("size-3.5", isRefreshingAll && "animate-spin")}
            />
            Refresh all
          </Button>
          {isSignedIn ? (
            <Button
              type="button"
              variant="ghost"
              size="default"
              className="w-full cursor-pointer justify-start rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive/80"
              onClick={() => void clerk.signOut({ redirectUrl: "/" })}
              disabled={!isAuthLoaded}
            >
              <SignOutIcon weight="bold" className="size-3.5" />
              Sign out
            </Button>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type AppNavbarProps = {
  isPreferencesPending: boolean;
  isSignedIn: boolean;
  isRefreshingAll: boolean;
  onBookmarksClick: () => void;
  onDefaultViewChange: (mode: ArticleViewMode) => Promise<void>;
  onPollingIntervalMinutesChange: (minutes: number) => Promise<void>;
  onRefreshAll: () => void;
  onSignIn: () => void;
  pollingIntervalMinutes: number;
  defaultView: ArticleViewMode;
  onToggleAddFeed?: () => void;
};

export function AppNavbar({
  isPreferencesPending,
  isSignedIn,
  isRefreshingAll,
  onBookmarksClick,
  onDefaultViewChange,
  onPollingIntervalMinutesChange,
  onRefreshAll,
  onSignIn,
  pollingIntervalMinutes,
  defaultView,
  onToggleAddFeed,
}: AppNavbarProps) {
  const [isGuestBookmarksTooltipOpen, setIsGuestBookmarksTooltipOpen] = useState(false);
  const convexAuth = useConvexAuth();
  const queryClient = useQueryClient();
  const bookmarksQuery = convexQuery(
    api.bookmarks.queries.listForCurrentUser,
    !convexAuth.isLoading && isSignedIn ? {} : "skip",
  );

  useEffect(() => {
    if (!isGuestBookmarksTooltipOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsGuestBookmarksTooltipOpen(false);
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [isGuestBookmarksTooltipOpen]);

  const handleBookmarksAction = () => {
    if (isSignedIn) {
      onBookmarksClick();
      return;
    }

    setIsGuestBookmarksTooltipOpen(true);
  };

  const handlePrefetchBookmarks = () => {
    if (convexAuth.isLoading || !isSignedIn) {
      return;
    }

    void queryClient.prefetchQuery(bookmarksQuery);
  };

  useHotkeySequence(["G", "B"], () => {
    if (typeof document !== "undefined" && isEditableElement(document.activeElement)) {
      return;
    }

    handleBookmarksAction();
  });

  return (
    <header className="pt-[env(safe-area-inset-top,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] z-20 shrink-0 border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-2 md:px-6 md:py-1.5">
        <div className="flex items-baseline gap-2.5 shrink-0">
          <Link
            to="/"
            className="select-none font-logo text-[2.1rem] leading-none tracking-wide text-foreground"
          >
            oopaw
          </Link>
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <TooltipProvider delayDuration={0}>
            <Tooltip open={!isSignedIn && isGuestBookmarksTooltipOpen}>
              <TooltipTrigger asChild>
                {isSignedIn ? (
                  <Button asChild variant="ghost" className="rounded-full">
                    <Link
                      to="/bookmarks"
                      onMouseEnter={handlePrefetchBookmarks}
                      onFocus={handlePrefetchBookmarks}
                    >
                      Bookmarks
                    </Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full"
                    onClick={handleBookmarksAction}
                  >
                    Bookmarks
                  </Button>
                )}
              </TooltipTrigger>
              {!isSignedIn ? (
                <TooltipContent
                  side="bottom"
                  sideOffset={8}
                  className="bg-secondary text-secondary-foreground"
                  arrowClassName="bg-secondary fill-secondary"
                >
                  need to sign in to save bookmarks
                </TooltipContent>
              ) : null}
            </Tooltip>
          </TooltipProvider>
          {onToggleAddFeed ? (
            <Button
              type="button"
              variant="secondary"
              className="cursor-pointer rounded-full"
              onClick={onToggleAddFeed}
            >
              <PlusIcon weight="bold" />
              <span className="min-[420px]:hidden">Add</span>
              <span className="hidden min-[420px]:inline">Add feed</span>
            </Button>
          ) : null}
          <ProfileMenu
            defaultView={defaultView}
            isSavingPreferences={isPreferencesPending}
            isRefreshingAll={isRefreshingAll}
            pollingIntervalMinutes={pollingIntervalMinutes}
            onDefaultViewChange={onDefaultViewChange}
            onPollingIntervalMinutesChange={onPollingIntervalMinutesChange}
            onRefreshAll={onRefreshAll}
            onSignIn={onSignIn}
          />
        </div>
      </div>
    </header>
  );
}

export const shouldShowFeedReaderBootScreen = (isClientReady: boolean) => !isClientReady;
export const getFeedReaderLayoutMode = (isMobile: boolean) => (isMobile ? "mobile" : "desktop");

export function FeedReaderBootScreen() {
  return (
    <div className="flex h-svh items-center justify-center overflow-hidden bg-background">
      <div role="status" aria-label="Loading feeds" className="text-muted-foreground">
        <SpinnerIcon className="size-5 animate-spin" />
      </div>
    </div>
  );
}

function EmptyFeedState({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="h-full min-w-0 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
      <div className="relative flex h-full items-center justify-center">
        <div className="pointer-events-none absolute inset-0 hidden select-none items-center justify-center overflow-hidden md:flex">
          {(
            [
              { x: -268, y: -72, rotate: -5 },
              { x: 264, y: -56, rotate: 4 },
              { x: -240, y: 96, rotate: 3 },
              { x: 252, y: 88, rotate: -4 },
            ] as { x: number; y: number; rotate: number }[]
          ).map((tile, index) => (
            <div
              key={index}
              className="paper-panel absolute w-48 rounded-xl border border-primary/40 p-4 opacity-[0.28] dark:opacity-[0.14]"
              style={{
                transform: `translate(${tile.x}px, ${tile.y}px) rotate(${tile.rotate}deg)`,
              }}
            >
              <div className="mb-3 h-2 w-20 rounded-full bg-foreground/20" />
              <div className="mb-2 h-1.5 w-32 rounded-full bg-foreground/12" />
              <div className="mb-2 h-1.5 w-24 rounded-full bg-foreground/12" />
              <div className="mb-5 h-1.5 w-16 rounded-full bg-foreground/8" />
              <div className="flex gap-2">
                <div className="h-1 w-10 rounded-full bg-primary/25" />
                <div className="h-1 w-7 rounded-full bg-foreground/8" />
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex max-w-sm flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div
            className={cn(
              "mb-5 flex items-center justify-center rounded-full text-muted-foreground",
              isMobile ? "size-16" : "size-18",
            )}
            style={{
              background: "color-mix(in oklab, var(--muted-foreground) 10%, transparent)",
              boxShadow: "0 0 0 10px color-mix(in oklab, var(--muted-foreground) 5%, transparent)",
            }}
          >
            <CowIcon weight="duotone" className={cn(isMobile ? "size-8" : "size-9")} />
          </div>
          <p className="font-display text-[0.92rem] tracking-[0.08em] text-muted-foreground md:text-[1.05rem]">
            no feeds yet
          </p>
        </div>
      </div>
    </div>
  );
}

type FeedReaderAppProps = {
  authIntent?: "sign-in";
  authRedirect?: string;
};

export function FeedReaderApp({ authIntent, authRedirect }: FeedReaderAppProps) {
  const clerk = useClerk();
  const navigate = useNavigate({ from: "/" });
  const autoOpenAuthKeyRef = useRef<string | null>(null);
  const {
    sourceInput,
    showAddForm,
    detailPanel,
    isReaderFullScreen,
    sourceSummaries,
    detailPanelSourceSummary,
    detailPanelItems,
    detailPanelPagination,
    selectedItem,
    articleViewMode,
    preferences,
    isPreferencesPending,
    isSignedIn,
    isBookmarked,
    isBookmarkPending,
    isRefreshingAll,
    addSourceError,
    isAddingSource,
    isLoadingMoreDetailPanelItems,
    setSourceInput,
    setShowAddForm,
    setArticleViewMode,
    setDefaultArticleViewMode,
    setPollingIntervalMinutes,
    handleAddSource,
    handleOpenFeed,
    handleSelectItem,
    handleBackToList,
    handleCloseDetailPanel,
    handleToggleFullScreen,
    handleToggleBookmark,
    handleMarkUnread,
    handleBookmarkItem,
    isItemBookmarked,
    handleRefreshAll,
    handleRemoveSource,
    handleLoadMoreDetailPanelItems,
  } = useFeedReader();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const detailPanelRef = useRef<PanelImperativeHandle>(null);
  const wasDetailPanelOpenRef = useRef(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const [detailPanelSize, setDetailPanelSize] = useAtom(detailPanelSizeAtom);
  const [itemListScroll] = useAtom(itemListScrollAtom);
  const setItemListScrollTop = useSetAtom(setItemListScrollAtom);
  const detailPanelOpen = detailPanel.mode !== "closed";
  const detailPanelMinSize = getDetailPanelMinSize(detailPanel);

  const openSignInModal = async (redirect = getCurrentHref()) => {
    await clerk.openSignIn({
      fallbackRedirectUrl: redirect,
      forceRedirectUrl: redirect,
    });
  };

  const handleBookmarksClick = () => {
    void navigate({ to: "/bookmarks" });
  };

  useHotkey(
    "Escape",
    () => {
      handleCloseDetailPanel();
    },
    {
      enabled: detailPanelOpen,
    },
  );

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  useEffect(() => {
    if (!isClientReady || authIntent !== "sign-in") {
      return;
    }

    const nextKey = authRedirect ?? "/";

    if (autoOpenAuthKeyRef.current === nextKey) {
      return;
    }

    autoOpenAuthKeyRef.current = nextKey;
    void clerk.openSignIn({
      fallbackRedirectUrl: nextKey,
      forceRedirectUrl: nextKey,
    });
    void navigate({
      to: "/",
      search: {},
      replace: true,
    });
  }, [authIntent, authRedirect, clerk, isClientReady, navigate]);

  useEffect(() => {
    if (isMobile) {
      wasDetailPanelOpenRef.current = detailPanelOpen;
      return;
    }

    if (detailPanelOpen) {
      const nextDetailPanelSize = getDetailPanelOpenSize(detailPanel, detailPanelSize);

      if (nextDetailPanelSize !== detailPanelSize) {
        setDetailPanelSize(nextDetailPanelSize);
      }

      if (!wasDetailPanelOpenRef.current || nextDetailPanelSize !== detailPanelSize) {
        detailPanelRef.current?.resize(`${nextDetailPanelSize}%`);
      }
    }

    if (!detailPanelOpen && wasDetailPanelOpenRef.current) {
      detailPanelRef.current?.collapse();
    }

    wasDetailPanelOpenRef.current = detailPanelOpen;
  }, [detailPanel, detailPanelOpen, detailPanelSize, isMobile, setDetailPanelSize]);

  if (shouldShowFeedReaderBootScreen(isClientReady)) {
    return <FeedReaderBootScreen />;
  }

  const detailPanelContent = (
    <div className="h-full min-w-0 overflow-hidden md:pl-2">
      {detailPanel.mode === "list" && (
        <ItemList
          source={detailPanelSourceSummary?.source}
          items={detailPanelItems}
          selectedItemId={null}
          hasMore={Boolean(detailPanelPagination?.nextPageUrl)}
          isLoadingMore={isLoadingMoreDetailPanelItems}
          onSelect={handleSelectItem}
          onLoadMore={() => handleLoadMoreDetailPanelItems(detailPanel.sourceId)}
          onClose={handleCloseDetailPanel}
          onMarkUnread={handleMarkUnread}
          onBookmarkItem={
            detailPanelSourceSummary?.source
              ? (item) => handleBookmarkItem(item, detailPanelSourceSummary.source)
              : undefined
          }
          onRequireSignIn={!isSignedIn ? () => void openSignInModal("/") : undefined}
          isItemBookmarked={isItemBookmarked}
          isSignedIn={isSignedIn}
          isBookmarkPending={isBookmarkPending}
          scrollTop={
            detailPanelSourceSummary?.source
              ? (itemListScroll[detailPanelSourceSummary.source.id] ?? 0)
              : 0
          }
          onScrollTopChange={(scrollTop) => {
            if (!detailPanelSourceSummary?.source) {
              return;
            }

            setItemListScrollTop({
              sourceId: detailPanelSourceSummary.source.id,
              scrollTop,
            });
          }}
        />
      )}

      {detailPanel.mode === "reader" && (
        <ReaderPane
          item={selectedItem}
          articleViewMode={articleViewMode}
          isBookmarked={isBookmarked}
          isBookmarkPending={isBookmarkPending}
          isFullScreen={false}
          onBack={handleBackToList}
          onBookmarkToggle={isSignedIn ? handleToggleBookmark : undefined}
          onRequireSignIn={!isSignedIn ? () => void openSignInModal("/") : undefined}
          onClose={handleCloseDetailPanel}
          onToggleFullScreen={handleToggleFullScreen}
          onArticleViewModeChange={setArticleViewMode}
          onMarkUnread={selectedItem?.isRead ? () => handleMarkUnread(selectedItem.id) : undefined}
        />
      )}
    </div>
  );

  const mainContent =
    sourceSummaries.length > 0 ? (
      <SourceGrid
        sourceSummaries={sourceSummaries}
        detailPanelOpen={detailPanelOpen}
        selectedSourceId={detailPanel.mode === "closed" ? undefined : detailPanel.sourceId}
        onOpenFeed={handleOpenFeed}
        onRemoveSource={handleRemoveSource}
      />
    ) : (
      <EmptyFeedState isMobile={isMobile} />
    );

  return (
    <>
      <div className="min-h-svh flex h-svh flex-col overflow-hidden bg-background">
        <AppNavbar
          isPreferencesPending={isPreferencesPending}
          isSignedIn={isSignedIn}
          isRefreshingAll={isRefreshingAll}
          onBookmarksClick={handleBookmarksClick}
          onDefaultViewChange={setDefaultArticleViewMode}
          onPollingIntervalMinutesChange={setPollingIntervalMinutes}
          onRefreshAll={handleRefreshAll}
          onSignIn={() => void openSignInModal()}
          pollingIntervalMinutes={preferences.pollingIntervalMinutes}
          defaultView={preferences.defaultView}
          onToggleAddFeed={() => setShowAddForm((value) => !value)}
        />

        <div
          className={cn(
            "overflow-hidden transition-all duration-200 ease-in-out",
            showAddForm ? "max-h-40" : "max-h-0",
          )}
        >
          <div className="border-b border-border/30 px-4 pb-4 pt-2 md:px-6">
            <SourceForm
              value={sourceInput}
              error={addSourceError}
              isSubmitting={isAddingSource}
              isOpen={showAddForm}
              onChange={setSourceInput}
              onSubmit={handleAddSource}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>

        {getFeedReaderLayoutMode(isMobile) === "mobile" ? (
          <div className="flex-1 min-h-0" data-testid="mobile-feed-shell">
            {mainContent}
          </div>
        ) : (
          <ResizablePanelGroup
            orientation="horizontal"
            className="flex-1 min-h-0 min-w-0"
            data-testid="desktop-feed-shell"
          >
            <ResizablePanel defaultSize="100%" minSize="30%" className="min-w-0">
              {mainContent}
            </ResizablePanel>

            <ResizableHandle
              withHandle
              className={cn(
                "cursor-col-resize",
                !detailPanelOpen && "invisible pointer-events-none",
              )}
            />

            <ResizablePanel
              className="min-w-0"
              panelRef={detailPanelRef}
              collapsible
              collapsedSize="0%"
              defaultSize="0%"
              minSize={`${detailPanelMinSize}%`}
              maxSize={`${MAX_FEED_READER_PANEL_SIZE}%`}
              onResize={(size) => {
                if (size.asPercentage === 0 && detailPanelOpen) {
                  handleCloseDetailPanel();
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

      {isMobile && detailPanelOpen && (
        <div className="pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] fixed inset-0 z-30 flex flex-col overflow-hidden bg-background">
          {detailPanelContent}
        </div>
      )}

      {!isMobile && isReaderFullScreen && detailPanel.mode === "reader" && selectedItem && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background">
          <ReaderPane
            item={selectedItem}
            articleViewMode={articleViewMode}
            isBookmarked={isBookmarked}
            isBookmarkPending={isBookmarkPending}
            isFullScreen={true}
            onBack={handleBackToList}
            onBookmarkToggle={isSignedIn ? handleToggleBookmark : undefined}
            onRequireSignIn={!isSignedIn ? () => void openSignInModal("/") : undefined}
            onClose={handleCloseDetailPanel}
            onToggleFullScreen={handleToggleFullScreen}
            onArticleViewModeChange={setArticleViewMode}
            onMarkUnread={selectedItem.isRead ? () => handleMarkUnread(selectedItem.id) : undefined}
          />
        </div>
      )}
    </>
  );
}
