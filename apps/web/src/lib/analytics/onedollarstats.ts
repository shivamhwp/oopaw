const DEFAULT_ONEDOLLARSTATS_SCRIPT_SRC = "https://onedollarstats.com/tracker.js";

function parseBooleanFlag(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

export type OneDollarStatsScriptConfig = {
  siteId: string;
  scriptSrc: string;
};

export function getOneDollarStatsScriptConfig(
  env: Pick<
    ImportMetaEnv,
    "DEV" | "VITE_ONEDOLLARSTATS_SITE_ID" | "VITE_ONEDOLLARSTATS_SCRIPT_SRC" | "VITE_ONEDOLLARSTATS_ENABLED"
  >,
): OneDollarStatsScriptConfig | null {
  const siteId = env.VITE_ONEDOLLARSTATS_SITE_ID?.trim();

  if (!siteId) {
    return null;
  }

  const explicitEnabled = parseBooleanFlag(env.VITE_ONEDOLLARSTATS_ENABLED);

  if (explicitEnabled === false) {
    return null;
  }

  if (env.DEV && explicitEnabled !== true) {
    return null;
  }

  const scriptSrc = env.VITE_ONEDOLLARSTATS_SCRIPT_SRC?.trim() || DEFAULT_ONEDOLLARSTATS_SCRIPT_SRC;

  return {
    siteId,
    scriptSrc,
  };
}
