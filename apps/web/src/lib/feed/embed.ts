const blockedByXFrameOptions = ({
  header,
  appOrigin,
  articleOrigin,
}: {
  header: string | null;
  appOrigin?: string;
  articleOrigin?: string;
}) => {
  if (!header) {
    return null;
  }

  const value = header.trim();
  const normalized = value.toUpperCase();

  if (normalized === "DENY") {
    return "This site disallows being displayed inside another page.";
  }

  if (normalized === "SAMEORIGIN") {
    return appOrigin && articleOrigin && appOrigin === articleOrigin
      ? null
      : "This site only allows embedding on the same origin.";
  }

  if (normalized.startsWith("ALLOW-FROM")) {
    const allowedOrigin = value.slice("ALLOW-FROM".length).trim();

    if (!allowedOrigin) {
      return "This site uses unsupported frame restrictions.";
    }

    return appOrigin === allowedOrigin
      ? null
      : "This site only allows embedding from approved origins.";
  }

  return "This site uses unsupported frame restrictions.";
};

const matchesFrameAncestorSource = ({
  source,
  appOrigin,
  articleOrigin,
}: {
  source: string;
  appOrigin: string;
  articleOrigin?: string;
}) => {
  if (source === "*") {
    return true;
  }

  if (source === "'self'") {
    return Boolean(articleOrigin) && articleOrigin === appOrigin;
  }

  if (source.endsWith(":")) {
    return new URL(appOrigin).protocol === source;
  }

  if (!source.includes("://")) {
    return false;
  }

  try {
    const allowedUrl = new URL(source);
    const appUrl = new URL(appOrigin);

    if (allowedUrl.hostname.startsWith("*.")) {
      const suffix = allowedUrl.hostname.slice(1);

      return (
        appUrl.protocol === allowedUrl.protocol &&
        appUrl.hostname.endsWith(suffix) &&
        appUrl.port === allowedUrl.port
      );
    }

    return appUrl.origin === allowedUrl.origin;
  } catch {
    return false;
  }
};

const blockedByFrameAncestors = ({
  header,
  appOrigin,
  articleOrigin,
}: {
  header: string | null;
  appOrigin?: string;
  articleOrigin?: string;
}) => {
  if (!header) {
    return null;
  }

  const directive = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith("frame-ancestors"));

  if (!directive) {
    return null;
  }

  const sources = directive.slice("frame-ancestors".length).trim().split(/\s+/).filter(Boolean);

  if (!sources.length || sources.includes("'none'")) {
    return "This site disallows being framed by other pages.";
  }

  if (!appOrigin) {
    return "This site restricts which origins may embed it.";
  }

  return sources.some((source) => matchesFrameAncestorSource({ source, appOrigin, articleOrigin }))
    ? null
    : "This site restricts which origins may embed it.";
};

export const hasEmbedPolicyHeaders = (headers: Headers) =>
  Boolean(headers.get("x-frame-options") || headers.get("content-security-policy"));

export const inspectEmbedHeaders = ({
  headers,
  appOrigin,
  articleUrl,
}: {
  headers: Headers;
  appOrigin?: string;
  articleUrl: string;
}) => {
  const articleOrigin = new URL(articleUrl).origin;
  const xFrameBlocked = blockedByXFrameOptions({
    header: headers.get("x-frame-options"),
    appOrigin,
    articleOrigin,
  });

  if (xFrameBlocked) {
    return {
      canEmbed: false,
      blockedReason: xFrameBlocked,
    };
  }

  const cspBlocked = blockedByFrameAncestors({
    header: headers.get("content-security-policy"),
    appOrigin,
    articleOrigin,
  });

  if (cspBlocked) {
    return {
      canEmbed: false,
      blockedReason: cspBlocked,
    };
  }

  return {
    canEmbed: true,
    blockedReason: undefined,
  };
};
