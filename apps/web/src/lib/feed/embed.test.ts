import { describe, expect, it } from "vitest";
import { inspectEmbedHeaders } from "@/lib/feed/embed";

const inspect = (headers: Record<string, string>, appOrigin = "https://app.example.com") =>
  inspectEmbedHeaders({
    headers: new Headers(headers),
    appOrigin,
    articleUrl: "https://blog.example.com/posts/alpha",
  });

describe("embed header inspection", () => {
  it("allows embedding when no blocking headers are present", () => {
    expect(inspect({})).toEqual({
      canEmbed: true,
      blockedReason: undefined,
    });
  });

  it("blocks DENY x-frame-options", () => {
    expect(inspect({ "x-frame-options": "DENY" })).toEqual({
      canEmbed: false,
      blockedReason: "This site disallows being displayed inside another page.",
    });
  });

  it("blocks SAMEORIGIN for remote articles", () => {
    expect(inspect({ "x-frame-options": "SAMEORIGIN" })).toEqual({
      canEmbed: false,
      blockedReason: "This site only allows embedding on the same origin.",
    });
  });

  it("blocks frame-ancestors none", () => {
    expect(
      inspect({ "content-security-policy": "default-src 'self'; frame-ancestors 'none'" }),
    ).toEqual({
      canEmbed: false,
      blockedReason: "This site disallows being framed by other pages.",
    });
  });

  it("blocks restrictive frame-ancestors without the app origin", () => {
    expect(
      inspect({
        "content-security-policy":
          "default-src 'self'; frame-ancestors https://news.example.com https://portal.example.com",
      }),
    ).toEqual({
      canEmbed: false,
      blockedReason: "This site restricts which origins may embed it.",
    });
  });

  it("allows permissive frame-ancestors", () => {
    expect(inspect({ "content-security-policy": "frame-ancestors *" })).toEqual({
      canEmbed: true,
      blockedReason: undefined,
    });
  });
});
