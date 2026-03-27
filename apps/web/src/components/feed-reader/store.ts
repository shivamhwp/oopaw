import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  applyLoadMoreSourceItems,
  createEmptyFeedReaderState,
  mergeSourceDiscovery,
  removeSource,
  setSelectedSource,
} from "@/lib/feed-reader-state";
import {
  type ArticleViewMode,
  type DiscoveryResult,
  type LoadMoreSourceItemsResult,
} from "@/lib/types";

const FEED_READER_PANEL_SIZE_STORAGE_KEY = "papertrail.feed-reader.panel-size";
const FEED_READER_CURRENT_STORAGE_KEY = "papertrail.current";
const FEED_READER_SCROLL_STORAGE_KEY = "papertrail.feed-reader.scroll";

export const MIN_FEED_READER_READER_PANEL_SIZE = 40;
export const MIN_FEED_READER_LIST_PANEL_SIZE = 40;
const DEFAULT_FEED_READER_PANEL_SIZE = 50;
export const MAX_FEED_READER_PANEL_SIZE = 70;

const createClosedHomeState = () => ({ panel: "closed" }) as const;
const createClosedBookmarksState = () => ({ panel: "closed" }) as const;

const createInitialCurrentState = () => ({
  home: createClosedHomeState() as
    | { panel: "closed" }
    | { panel: "list"; sourceId: string }
    | { panel: "reader"; sourceId: string; itemId: string; blogViewMode: ArticleViewMode },
  bookmarks: createClosedBookmarksState() as
    | { panel: "closed" }
    | { panel: "reader"; bookmarkId: string; blogViewMode: ArticleViewMode },
});

type CurrentState = ReturnType<typeof createInitialCurrentState>;
type HomeCurrentState = CurrentState["home"];
type BookmarksCurrentState = CurrentState["bookmarks"];

export type DetailPanelState =
  | { mode: "closed" }
  | { mode: "list"; sourceId: string }
  | { mode: "reader"; sourceId: string; itemId: string };

export const feedReaderStateAtom = atom(createEmptyFeedReaderState());

export const sourceInputAtom = atom("");
export const showAddFormAtom = atom(false);
export const currentAtom = atomWithStorage(
  FEED_READER_CURRENT_STORAGE_KEY,
  createInitialCurrentState(),
  undefined,
  { getOnInit: true },
);
export const detailPanelSizeAtom = atomWithStorage(
  FEED_READER_PANEL_SIZE_STORAGE_KEY,
  DEFAULT_FEED_READER_PANEL_SIZE,
  undefined,
  { getOnInit: true },
);
export const itemListScrollAtom = atomWithStorage(
  FEED_READER_SCROLL_STORAGE_KEY,
  {} as Record<string, number>,
  undefined,
  { getOnInit: true },
);
export const isReaderFullScreenAtom = atom(false);

export const currentHomeAtom = atom(
  (get) => get(currentAtom).home,
  (get, set, value: HomeCurrentState | ((value: HomeCurrentState) => HomeCurrentState)) => {
    const nextValue = typeof value === "function" ? value(get(currentAtom).home) : value;

    set(currentAtom, {
      ...get(currentAtom),
      home: nextValue,
    });
  },
);

export const currentBookmarksAtom = atom(
  (get) => get(currentAtom).bookmarks,
  (
    get,
    set,
    value: BookmarksCurrentState | ((value: BookmarksCurrentState) => BookmarksCurrentState),
  ) => {
    const nextValue = typeof value === "function" ? value(get(currentAtom).bookmarks) : value;

    set(currentAtom, {
      ...get(currentAtom),
      bookmarks: nextValue,
    });
  },
);

export const detailPanelAtom = atom<DetailPanelState>((get) => {
  const currentHome = get(currentHomeAtom);

  if (currentHome.panel === "closed") {
    return { mode: "closed" };
  }

  return currentHome.panel === "reader"
    ? {
        mode: "reader",
        sourceId: currentHome.sourceId,
        itemId: currentHome.itemId,
      }
    : {
        mode: "list",
        sourceId: currentHome.sourceId,
      };
});

export const currentBlogViewModeAtom = atom((get) => {
  const currentHome = get(currentHomeAtom);
  const currentBookmarks = get(currentBookmarksAtom);

  if (currentHome.panel === "reader") {
    return currentHome.blogViewMode;
  }

  return currentBookmarks.panel === "reader" ? currentBookmarks.blogViewMode : undefined;
});

export const toggleReaderFullScreenAtom = atom(null, (get, set) => {
  set(isReaderFullScreenAtom, !get(isReaderFullScreenAtom));
});

export const openFeedAtom = atom(null, (_get, set, sourceId: string) => {
  set(currentHomeAtom, {
    panel: "list",
    sourceId,
  });
  set(feedReaderStateAtom, (state) => setSelectedSource(state, sourceId));
});

export const openItemAtom = atom(
  null,
  (_get, set, payload: { sourceId: string; itemId: string; defaultView: ArticleViewMode }) => {
    set(currentHomeAtom, {
      panel: "reader",
      sourceId: payload.sourceId,
      itemId: payload.itemId,
      blogViewMode: payload.defaultView,
    });
  },
);

export const backToFeedListAtom = atom(null, (get, set) => {
  const currentHome = get(currentHomeAtom);

  if (currentHome.panel !== "reader") {
    return;
  }

  set(currentHomeAtom, {
    panel: "list",
    sourceId: currentHome.sourceId,
  });
  set(isReaderFullScreenAtom, false);
});

export const closeHomePanelAtom = atom(null, (_get, set) => {
  set(currentHomeAtom, createClosedHomeState());
  set(isReaderFullScreenAtom, false);
});

export const setCurrentBlogViewModeAtom = atom(
  null,
  (get, set, payload: { route: "home" | "bookmarks"; mode: ArticleViewMode }) => {
    if (payload.route === "home") {
      const currentHome = get(currentHomeAtom);

      if (currentHome.panel !== "reader") {
        return;
      }

      set(currentHomeAtom, {
        ...currentHome,
        blogViewMode: payload.mode,
      });
      return;
    }

    const currentBookmarks = get(currentBookmarksAtom);

    if (currentBookmarks.panel !== "reader") {
      return;
    }

    set(currentBookmarksAtom, {
      ...currentBookmarks,
      blogViewMode: payload.mode,
    });
  },
);

export const openBookmarkAtom = atom(
  null,
  (_get, set, payload: { bookmarkId: string; defaultView: ArticleViewMode }) => {
    set(currentBookmarksAtom, {
      panel: "reader",
      bookmarkId: payload.bookmarkId,
      blogViewMode: payload.defaultView,
    });
  },
);

export const closeBookmarkPanelAtom = atom(null, (_get, set) => {
  set(currentBookmarksAtom, createClosedBookmarksState());
  set(isReaderFullScreenAtom, false);
});

export const addSourceSuccessAtom = atom(null, (_get, set, discovery: DiscoveryResult) => {
  set(feedReaderStateAtom, (state) => mergeSourceDiscovery(state, discovery));
  set(sourceInputAtom, "");
  set(showAddFormAtom, false);
  set(currentHomeAtom, {
    panel: "list",
    sourceId: discovery.source.id,
  });
});

export const removeSourceAtom = atom(null, (_get, set, sourceId: string) => {
  set(feedReaderStateAtom, (state) => removeSource(state, sourceId));
  set(currentHomeAtom, (currentHome) =>
    currentHome.panel !== "closed" && currentHome.sourceId === sourceId
      ? createClosedHomeState()
      : currentHome,
  );
});

export const applyLoadMoreSourceItemsAtom = atom(
  null,
  (_get, set, result: LoadMoreSourceItemsResult) => {
    set(feedReaderStateAtom, (state) => applyLoadMoreSourceItems(state, result));
  },
);

export const setItemListScrollAtom = atom(
  null,
  (get, set, payload: { sourceId: string; scrollTop: number }) => {
    set(itemListScrollAtom, {
      ...get(itemListScrollAtom),
      [payload.sourceId]: payload.scrollTop,
    });
  },
);

export type { BookmarksCurrentState, CurrentState, HomeCurrentState };
