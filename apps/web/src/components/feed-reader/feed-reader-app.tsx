import { useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import {
  ArrowClockwiseIcon,
  CheckIcon,
  CowIcon,
  DesktopIcon,
  EyeIcon,
  EyeSlashIcon,
  MoonIcon,
  PencilSimpleIcon,
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
import type { ProfileOption } from "@/components/feed-reader/use-profiles";
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
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme-provider";
import { api, type Id } from "@/lib/convex";
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

const CREATE_PROFILE_VALUE = "__create_profile__";

type ProfileControls = {
  profiles: ProfileOption[];
  selectedProfile: ProfileOption | null;
  selectedProfileId: Id<"profiles"> | null;
  isProfilesLoading: boolean;
  isCreatingProfile: boolean;
  isRenamingProfile: boolean;
  onSelectProfile: (profileId: Id<"profiles">) => void;
  onCreateProfile: () => Promise<void>;
  onRenameProfile: (profileId: Id<"profiles">, name: string) => Promise<void>;
};

function ProfileSwitcher({
  profiles,
  selectedProfile,
  selectedProfileId,
  isProfilesLoading,
  isCreatingProfile,
  isRenamingProfile,
  onSelectProfile,
  onCreateProfile,
  onRenameProfile,
}: ProfileControls) {
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<Id<"profiles"> | null>(null);
  const [draftName, setDraftName] = useState(selectedProfile?.name ?? "");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const editingProfile = profiles.find((profile) => profile._id === editingProfileId) ?? null;
  const editingProfileName = editingProfile?.name ?? "";

  useEffect(() => {
    setEditingProfileId(null);
  }, [selectedProfile?._id]);

  useEffect(() => {
    if (!editingProfileId) {
      setDraftName(selectedProfile?.name ?? "");
    }
  }, [editingProfileId, selectedProfile?.name]);

  useEffect(() => {
    if (!editingProfileId) {
      return;
    }

    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingProfileId]);

  const cancelRename = () => {
    setDraftName(editingProfileName || selectedProfile?.name || "");
    setEditingProfileId(null);
  };

  const commitRename = () => {
    const profileId = editingProfileId;
    const nextName = draftName.trim();

    if (profileId && nextName && nextName !== editingProfileName) {
      void onRenameProfile(profileId, nextName);
    }

    setEditingProfileId(null);
  };

  const startRename = (profile: ProfileOption) => {
    setDraftName(profile.name);
    setEditingProfileId(profile._id);
    setIsSelectOpen(true);
  };

  const handleProfileChange = (value: string) => {
    if (value === CREATE_PROFILE_VALUE) {
      cancelRename();
      void onCreateProfile();
      return;
    }

    cancelRename();
    onSelectProfile(value as Id<"profiles">);
  };

  return (
    <Select
      value={selectedProfileId ?? undefined}
      open={isSelectOpen}
      onOpenChange={(open) => {
        if (!open) {
          cancelRename();
        }

        setIsSelectOpen(open);
      }}
      onValueChange={handleProfileChange}
      disabled={isProfilesLoading}
    >
      <SelectTrigger
        className="w-[7.5rem] border-border/80 sm:w-[9.5rem]"
        aria-label="Select profile"
      >
        <SelectValue placeholder={isProfilesLoading ? "Profiles" : "Default"} />
      </SelectTrigger>
      <SelectContent align="start">
        {profiles.map((profile) =>
          editingProfileId === profile._id ? (
            <div
              key={profile._id}
              className="relative flex min-h-8 items-center rounded-md bg-background/45 py-1 pr-8 pl-1.5 backdrop-blur-md"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Input
                ref={renameInputRef}
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelRename();
                    return;
                  }

                  if (event.key !== "Enter") {
                    return;
                  }

                  event.preventDefault();
                  commitRename();
                }}
                className="h-7 bg-background/70 px-2 py-1 text-sm backdrop-blur-sm"
                aria-label={`Rename ${profile.name}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute top-1/2 right-1.5 size-6 -translate-y-1/2 rounded-md bg-background/40 text-muted-foreground backdrop-blur-sm hover:text-foreground"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  commitRename();
                }}
                aria-label={`Save ${profile.name}`}
              >
                <CheckIcon className="size-3.5" weight="bold" />
              </Button>
            </div>
          ) : (
            <div key={profile._id} className="group/profile-option relative">
              <SelectItem value={profile._id} showIndicator={false} className="pr-9">
                {profile.name}
              </SelectItem>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="pointer-events-none absolute top-1/2 right-1.5 z-10 size-6 -translate-y-1/2 rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/profile-option:pointer-events-auto group-hover/profile-option:opacity-100 group-focus-within/profile-option:pointer-events-auto group-focus-within/profile-option:opacity-100 hover:text-foreground"
                disabled={isRenamingProfile}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  startRename(profile);
                }}
                aria-label={`Rename ${profile.name}`}
              >
                <PencilSimpleIcon className="size-3.5" weight="bold" />
              </Button>
            </div>
          ),
        )}
        <SelectSeparator />
        <SelectItem value={CREATE_PROFILE_VALUE} disabled={isCreatingProfile}>
          <span className="flex items-center gap-2">
            {isCreatingProfile ? (
              <SpinnerIcon className="size-3.5 animate-spin" weight="bold" />
            ) : (
              <PlusIcon className="size-3.5" weight="bold" />
            )}
            Add profile
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

function ProfileMenu({
  defaultView,
  isDefaultViewPending,
  isPollingIntervalPending,
  isRefreshingAll,
  pollingIntervalMinutes,
  onDefaultViewChange,
  onPollingIntervalMinutesChange,
  onRefreshAll,
  onSignIn,
}: {
  defaultView: ArticleViewMode;
  isDefaultViewPending: boolean;
  isPollingIntervalPending: boolean;
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
  const [lockedSettingsTooltip, setLockedSettingsTooltip] = useState<"polling" | "view" | null>(
    null,
  );
  const lockedSettingsTooltipTimeoutRef = useRef<number | null>(null);
  const EmailVisibilityIcon = isEmailVisible ? EyeSlashIcon : EyeIcon;
  const arePreferenceControlsLocked = !isAuthLoaded || !isSignedIn;
  const isPollingIntervalDisabled = arePreferenceControlsLocked || isPollingIntervalPending;
  const isDefaultViewDisabled = arePreferenceControlsLocked || isDefaultViewPending;
  const shouldShowProfileSection = isSignedIn || !isAuthLoaded;
  const profileName = isAuthLoaded && isSignedIn ? displayName : AUTH_LOADING_NAME;
  const profileEmail = isAuthLoaded && isSignedIn ? email : AUTH_LOADING_EMAIL;
  const profileInitials = profileName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const showLockedSettingsTooltip = (section: "polling" | "view") => {
    if (!isAuthLoaded || isSignedIn) {
      return;
    }

    if (lockedSettingsTooltipTimeoutRef.current) {
      window.clearTimeout(lockedSettingsTooltipTimeoutRef.current);
    }

    setLockedSettingsTooltip(section);
    lockedSettingsTooltipTimeoutRef.current = window.setTimeout(() => {
      setLockedSettingsTooltip(null);
      lockedSettingsTooltipTimeoutRef.current = null;
    }, 1800);
  };
  const createLockedSettingsHandlers = (section: "polling" | "view") => ({
    onClick: () => showLockedSettingsTooltip(section),
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      showLockedSettingsTooltip(section);
    },
  });

  useEffect(
    () => () => {
      if (lockedSettingsTooltipTimeoutRef.current) {
        window.clearTimeout(lockedSettingsTooltipTimeoutRef.current);
      }
    },
    [],
  );

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
        <TooltipProvider delayDuration={0}>
          <Tooltip open={lockedSettingsTooltip === "polling"}>
            <TooltipTrigger asChild>
              <div
                className={cn("px-1.5 pb-1", arePreferenceControlsLocked && "cursor-not-allowed")}
                role={arePreferenceControlsLocked ? "button" : undefined}
                tabIndex={arePreferenceControlsLocked ? 0 : undefined}
                {...(arePreferenceControlsLocked
                  ? createLockedSettingsHandlers("polling")
                  : undefined)}
              >
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
                        disabled={isPollingIntervalDisabled}
                      >
                        {option.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              sideOffset={8}
              className="bg-secondary text-secondary-foreground"
              arrowClassName="bg-secondary fill-secondary"
            >
              sign in to change this
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Article View</DropdownMenuLabel>
        <TooltipProvider delayDuration={0}>
          <Tooltip open={lockedSettingsTooltip === "view"}>
            <TooltipTrigger asChild>
              <div
                className={cn("px-1.5 pb-1", arePreferenceControlsLocked && "cursor-not-allowed")}
                role={arePreferenceControlsLocked ? "button" : undefined}
                tabIndex={arePreferenceControlsLocked ? 0 : undefined}
                {...(arePreferenceControlsLocked
                  ? createLockedSettingsHandlers("view")
                  : undefined)}
              >
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
                        disabled={isDefaultViewDisabled}
                      >
                        {view}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              sideOffset={8}
              className="bg-secondary text-secondary-foreground"
              arrowClassName="bg-secondary fill-secondary"
            >
              sign in to change this
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

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
  profileControls: ProfileControls;
  isDefaultViewPending: boolean;
  isPollingIntervalPending: boolean;
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
  profileControls,
  isDefaultViewPending,
  isPollingIntervalPending,
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
        <div className="flex min-w-0 shrink items-center gap-2.5">
          <Link
            to="/"
            className="shrink-0 select-none font-logo text-[2.1rem] leading-none tracking-wide text-foreground"
          >
            oopaw
          </Link>
          {isSignedIn || profileControls.isProfilesLoading ? (
            <ProfileSwitcher {...profileControls} />
          ) : null}
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
            isDefaultViewPending={isDefaultViewPending}
            isRefreshingAll={isRefreshingAll}
            isPollingIntervalPending={isPollingIntervalPending}
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
      <output aria-label="Loading feeds" className="text-muted-foreground">
        <SpinnerIcon className="size-5 animate-spin" />
      </output>
    </div>
  );
}

function EmptyFeedState({ isMobile, isLoading }: { isMobile: boolean; isLoading: boolean }) {
  return (
    <div className="app-scroll-y h-full min-w-0 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
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

        {isLoading ? (
          <output
            aria-label="Loading feeds"
            className="relative z-10 text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            <SpinnerIcon className="size-5 animate-spin" />
          </output>
        ) : (
          <div className="relative z-10 flex max-w-sm flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div
              className={cn(
                "mb-5 flex items-center justify-center rounded-full text-muted-foreground",
                isMobile ? "size-16" : "size-18",
              )}
              style={{
                background: "color-mix(in oklab, var(--muted-foreground) 10%, transparent)",
                boxShadow:
                  "0 0 0 10px color-mix(in oklab, var(--muted-foreground) 5%, transparent)",
              }}
            >
              <CowIcon weight="duotone" className={cn(isMobile ? "size-8" : "size-9")} />
            </div>
            <p className="font-display text-[0.92rem] tracking-[0.08em] text-muted-foreground md:text-[1.05rem]">
              no feeds yet
            </p>
          </div>
        )}
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
    profiles,
    selectedProfile,
    selectedProfileId,
    isProfilesLoading,
    isCreatingProfile,
    isRenamingProfile,
    isDefaultViewPending,
    isPollingIntervalPending,
    isSignedIn,
    isBookmarked,
    isBookmarkPending,
    isRefreshingAll,
    isSourcesLoading,
    addSourceError,
    isAddingSource,
    isLoadingMoreDetailPanelItems,
    setSourceInput,
    setShowAddForm,
    setArticleViewMode,
    setDefaultArticleViewMode,
    setPollingIntervalMinutes,
    selectProfile,
    createNewProfile,
    renameCurrentProfile,
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
      <EmptyFeedState isMobile={isMobile} isLoading={isSourcesLoading} />
    );

  return (
    <>
      <div className="min-h-svh flex h-svh flex-col overflow-hidden overscroll-none bg-background">
        <AppNavbar
          profileControls={{
            profiles,
            selectedProfile,
            selectedProfileId,
            isProfilesLoading,
            isCreatingProfile,
            isRenamingProfile,
            onSelectProfile: selectProfile,
            onCreateProfile: createNewProfile,
            onRenameProfile: renameCurrentProfile,
          }}
          isDefaultViewPending={isDefaultViewPending}
          isPollingIntervalPending={isPollingIntervalPending}
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
          />
        </div>
      )}
    </>
  );
}
