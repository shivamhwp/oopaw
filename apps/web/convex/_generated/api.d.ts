/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as bookmarks_mutations from "../bookmarks/mutations.js";
import type * as bookmarks_queries from "../bookmarks/queries.js";
import type * as feedSubscriptions_mutations from "../feedSubscriptions/mutations.js";
import type * as feedSubscriptions_queries from "../feedSubscriptions/queries.js";
import type * as lib_auth from "../lib/auth.js";
import type * as preferences_mutations from "../preferences/mutations.js";
import type * as preferences_queries from "../preferences/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "bookmarks/mutations": typeof bookmarks_mutations;
  "bookmarks/queries": typeof bookmarks_queries;
  "feedSubscriptions/mutations": typeof feedSubscriptions_mutations;
  "feedSubscriptions/queries": typeof feedSubscriptions_queries;
  "lib/auth": typeof lib_auth;
  "preferences/mutations": typeof preferences_mutations;
  "preferences/queries": typeof preferences_queries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
