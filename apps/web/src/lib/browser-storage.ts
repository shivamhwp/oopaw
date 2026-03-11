const isStorageLike = (value: unknown): value is Storage =>
  !!value &&
  typeof value === "object" &&
  typeof (value as Storage).getItem === "function" &&
  typeof (value as Storage).setItem === "function" &&
  typeof (value as Storage).removeItem === "function";

export const getBrowserStorage = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return isStorageLike(window.localStorage) ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
};
