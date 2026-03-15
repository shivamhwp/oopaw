import { useEffect, useRef, useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/tanstack-react-start";
import {
  CowIcon,
  DesktopIcon,
  EyeIcon,
  EyeSlashIcon,
  MoonIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  SpinnerIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAtom, useAtomValue } from "jotai";
import { type PanelImperativeHandle } from "react-resizable-panels";
import { toast } from "sonner";
import { ItemList } from "@/components/feed-reader/item-list";
import { ReaderPane } from "@/components/feed-reader/reader-pane";
import { SourceForm } from "@/components/feed-reader/source-form";
import {
  detailPanelOpenAtom,
  detailPanelSizeAtom,
  MAX_FEED_READER_PANEL_SIZE,
  MIN_FEED_READER_LIST_PANEL_SIZE,
  MIN_FEED_READER_READER_PANEL_SIZE,
  type DetailPanelState,
} from "@/components/feed-reader/store";
import { SourceGrid } from "@/components/feed-reader/source-grid";
import { SourceSyncController } from "@/components/feed-reader/source-sync-controller";
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
import { useTheme } from "@/components/theme-provider";
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

const articleViewOptions: ArticleViewMode[] = ["reader", "site"];
const pollingOptions = [
  { label: "10", value: 10 },
  { label: "15", value: 15 },
  { label: "30", value: 30 },
  { label: "60", value: 60 },
];

const getCurrentHref = () =>
  typeof window === "undefined"
    ? "/"
    : `${window.location.pathname}${window.location.search}${window.location.hash}`;

const getUserDisplayName = (user: ReturnType<typeof useUser>["user"]) =>
  user?.fullName ?? user?.firstName ?? user?.username ?? "Profile";

const getUserEmail = (user: ReturnType<typeof useUser>["user"]) =>
  user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? "";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const idx = Math.max(
    0,
    THEME_CYCLE.findIndex((entry) => entry.value === theme),
  );
  const current = THEME_CYCLE[idx]!;
  const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]!;
  const { Icon } = current;

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className="cursor-pointer rounded-full"
      onClick={() => setTheme(next.value)}
      aria-label={`Switch to ${next.label} theme`}
    >
      <Icon weight="bold" />
    </Button>
  );
}

function ProfileMenu({
  defaultView,
  isSavingPreferences,
  pollingIntervalMinutes,
  onDefaultViewChange,
  onPollingIntervalMinutesChange,
}: {
  defaultView: ArticleViewMode;
  isSavingPreferences: boolean;
  pollingIntervalMinutes: number;
  onDefaultViewChange: (mode: ArticleViewMode) => Promise<void>;
  onPollingIntervalMinutesChange: (minutes: number) => Promise<void>;
}) {
  const clerk = useClerk();
  const { user } = useUser();
  const displayName = getUserDisplayName(user);
  const email = getUserEmail(user);
  const [isEmailVisible, setIsEmailVisible] = useState(false);
  const EmailVisibilityIcon = isEmailVisible ? EyeSlashIcon : EyeIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="icon" aria-label="Open settings">
          <SlidersHorizontalIcon weight="bold" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(16rem,calc(100vw-1rem))]">
        <div className="space-y-1 px-2.5 py-2">
          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
          {email ? (
            <div className="flex items-center gap-1.5">
              <p
                className={cn(
                  "min-w-0 flex-1 truncate text-xs text-muted-foreground transition-all",
                  !isEmailVisible && "blur-sm",
                )}
              >
                {email}
              </p>
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
            </div>
          ) : null}
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
                  disabled={isSavingPreferences}
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
                  disabled={isSavingPreferences}
                >
                  {view}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <DropdownMenuSeparator />

        <div className="p-1.5">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start rounded-lg"
            onClick={() => void clerk.signOut({ redirectUrl: "/" })}
          >
            Sign out
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type AppNavbarProps = {
  isPreferencesPending: boolean;
  isSignedIn: boolean;
  onBookmarksClick: () => void;
  onDefaultViewChange: (mode: ArticleViewMode) => Promise<void>;
  onPollingIntervalMinutesChange: (minutes: number) => Promise<void>;
  onSignIn: () => void;
  pollingIntervalMinutes: number;
  defaultView: ArticleViewMode;
  onToggleAddFeed?: () => void;
};

export function AppNavbar({
  isPreferencesPending,
  isSignedIn,
  onBookmarksClick,
  onDefaultViewChange,
  onPollingIntervalMinutesChange,
  onSignIn,
  pollingIntervalMinutes,
  defaultView,
  onToggleAddFeed,
}: AppNavbarProps) {
  return (
    <header className="pt-[env(safe-area-inset-top,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] z-20 shrink-0 border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col gap-2 px-3 py-2 sm:px-4 md:flex-row md:items-center md:justify-between md:px-6 md:py-1.5">
        <div className="flex items-baseline gap-2.5">
          <Link
            to="/"
            className="select-none font-logo text-[1.8rem] leading-none tracking-wide text-foreground sm:text-[2.1rem]"
          >
            oop
          </Link>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end md:gap-1.5">
          {isSignedIn ? (
            <Button asChild variant="ghost" className="min-w-0 flex-1 rounded-full md:flex-none">
              <Link to="/bookmarks">Bookmarks</Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="min-w-0 flex-1 rounded-full md:flex-none"
              onClick={onBookmarksClick}
            >
              Bookmarks
            </Button>
          )}
          {onToggleAddFeed ? (
            <Button
              type="button"
              className="min-w-0 flex-1 cursor-pointer rounded-full md:flex-none"
              onClick={onToggleAddFeed}
            >
              <PlusIcon weight="bold" />
              <span className="min-[420px]:hidden">Add</span>
              <span className="hidden min-[420px]:inline">Add feed</span>
            </Button>
          ) : null}
          {isSignedIn ? (
            <ProfileMenu
              defaultView={defaultView}
              isSavingPreferences={isPreferencesPending}
              pollingIntervalMinutes={pollingIntervalMinutes}
              onDefaultViewChange={onDefaultViewChange}
              onPollingIntervalMinutesChange={onPollingIntervalMinutesChange}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              className="rounded-full md:flex-none"
              onClick={onSignIn}
            >
              Sign in
            </Button>
          )}
          <ThemeToggle />
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

function SignInRequiredScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Button type="button" variant="secondary" onClick={onSignIn}>
        Sign in with Google
      </Button>
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
  const { isLoaded: isClerkLoaded, isSignedIn: hasClerkSession } = useAuth();
  const clerk = useClerk();
  const navigate = useNavigate({ from: "/" });
  const autoOpenAuthKeyRef = useRef<string | null>(null);
  const {
    state,
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
    effectivePollingIntervalMs,
    isPreferencesPending,
    isAuthLoading,
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
    handleRefreshAll,
    handleRemoveSource,
    handleLoadMoreDetailPanelItems,
    handleSourceRefresh,
    handleSourceError,
  } = useFeedReader();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const detailPanelOpen = useAtomValue(detailPanelOpenAtom);
  const detailPanelRef = useRef<PanelImperativeHandle>(null);
  const wasDetailPanelOpenRef = useRef(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const [detailPanelSize, setDetailPanelSize] = useAtom(detailPanelSizeAtom);
  const detailPanelMinSize = getDetailPanelMinSize(detailPanel);

  const openSignInModal = async (redirect = getCurrentHref()) => {
    await clerk.openSignIn({
      fallbackRedirectUrl: redirect,
      forceRedirectUrl: redirect,
    });
  };

  const handleBookmarksClick = () => {
    if (hasClerkSession) {
      void navigate({ to: "/bookmarks" });
      return;
    }

    toast.info("Sign in to view your bookmarks.");
  };

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  useEffect(() => {
    if (!isClientReady || !isClerkLoaded || authIntent !== "sign-in") {
      return;
    }

    if (hasClerkSession) {
      void navigate({
        to: "/",
        search: {},
        replace: true,
      });
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
  }, [authIntent, authRedirect, clerk, hasClerkSession, isClerkLoaded, isClientReady, navigate]);

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

  if (
    shouldShowFeedReaderBootScreen(isClientReady) ||
    !isClerkLoaded ||
    (hasClerkSession && isAuthLoading)
  ) {
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

  if (!hasClerkSession) {
    return <SignInRequiredScreen onSignIn={() => void openSignInModal("/")} />;
  }

  return (
    <>
      {sourceSummaries.map(({ source }) => (
        <SourceSyncController
          key={source.sourceId}
          source={source}
          initialItems={state.sources[source.sourceId]?.items ?? []}
          seenItemIds={state.sources[source.sourceId]?.seenItemIds ?? []}
          enabled={true}
          pollingIntervalMs={effectivePollingIntervalMs}
          lastCheckedAt={state.sources[source.sourceId]?.lastCheckedAt}
          onRefresh={(result) => handleSourceRefresh(result, source.sourceId)}
          onError={(message) => handleSourceError(source.sourceId, message)}
        />
      ))}

      <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-background">
        <AppNavbar
          isPreferencesPending={isPreferencesPending}
          isSignedIn={hasClerkSession}
          onBookmarksClick={handleBookmarksClick}
          onDefaultViewChange={setDefaultArticleViewMode}
          onPollingIntervalMinutesChange={setPollingIntervalMinutes}
          onSignIn={() => void openSignInModal()}
          pollingIntervalMinutes={preferences.pollingIntervalMinutes}
          defaultView={preferences.defaultView}
          onToggleAddFeed={() => setShowAddForm((value) => !value)}
        />

        <div
          className={cn(
            "overflow-hidden transition-all duration-200 ease-in-out",
            showAddForm ? "max-h-52 md:max-h-40" : "max-h-0",
          )}
        >
          <div className="border-b border-border/30 px-4 pb-4 pt-2 md:px-6">
            <SourceForm
              value={sourceInput}
              error={addSourceError}
              isSubmitting={isAddingSource}
              onChange={setSourceInput}
              onSubmit={handleAddSource}
              onCancel={() => setShowAddForm(false)}
              onRefreshAll={handleRefreshAll}
              isRefreshing={isRefreshingAll}
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
          />
        </div>
      )}
    </>
  );
}
