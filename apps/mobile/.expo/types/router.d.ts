/* eslint-disable */
import * as Router from "expo-router";

export * from "expo-router";

declare module "expo-router" {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams:
        | { pathname: Router.RelativePathString; params?: Router.UnknownInputParams }
        | { pathname: Router.ExternalPathString; params?: Router.UnknownInputParams }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(auth)"}/sign-in` | `/sign-in`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(tabs)"}/bookmarks` | `/bookmarks`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(tabs)"}` | `/`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(tabs)"}/settings` | `/settings`; params?: Router.UnknownInputParams }
        | {
            pathname: `/article/[sourceId]/[itemId]`;
            params: Router.UnknownInputParams & {
              sourceId: string | number;
              itemId: string | number;
            };
          }
        | {
            pathname: `/feed/[sourceId]`;
            params: Router.UnknownInputParams & { sourceId: string | number };
          };
      hrefOutputParams:
        | { pathname: Router.RelativePathString; params?: Router.UnknownOutputParams }
        | { pathname: Router.ExternalPathString; params?: Router.UnknownOutputParams }
        | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams }
        | { pathname: `${"/(auth)"}/sign-in` | `/sign-in`; params?: Router.UnknownOutputParams }
        | { pathname: `${"/(tabs)"}/bookmarks` | `/bookmarks`; params?: Router.UnknownOutputParams }
        | { pathname: `${"/(tabs)"}` | `/`; params?: Router.UnknownOutputParams }
        | { pathname: `${"/(tabs)"}/settings` | `/settings`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/article/[sourceId]/[itemId]`;
            params: Router.UnknownOutputParams & { sourceId: string; itemId: string };
          }
        | {
            pathname: `/feed/[sourceId]`;
            params: Router.UnknownOutputParams & { sourceId: string };
          };
      href:
        | Router.RelativePathString
        | Router.ExternalPathString
        | `/_sitemap${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/sign-in${`?${string}` | `#${string}` | ""}`
        | `/sign-in${`?${string}` | `#${string}` | ""}`
        | `${"/(tabs)"}/bookmarks${`?${string}` | `#${string}` | ""}`
        | `/bookmarks${`?${string}` | `#${string}` | ""}`
        | `${"/(tabs)"}${`?${string}` | `#${string}` | ""}`
        | `/${`?${string}` | `#${string}` | ""}`
        | `${"/(tabs)"}/settings${`?${string}` | `#${string}` | ""}`
        | `/settings${`?${string}` | `#${string}` | ""}`
        | { pathname: Router.RelativePathString; params?: Router.UnknownInputParams }
        | { pathname: Router.ExternalPathString; params?: Router.UnknownInputParams }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(auth)"}/sign-in` | `/sign-in`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(tabs)"}/bookmarks` | `/bookmarks`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(tabs)"}` | `/`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(tabs)"}/settings` | `/settings`; params?: Router.UnknownInputParams }
        | `/article/${Router.SingleRoutePart<T>}/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/feed/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | {
            pathname: `/article/[sourceId]/[itemId]`;
            params: Router.UnknownInputParams & {
              sourceId: string | number;
              itemId: string | number;
            };
          }
        | {
            pathname: `/feed/[sourceId]`;
            params: Router.UnknownInputParams & { sourceId: string | number };
          };
    }
  }
}
