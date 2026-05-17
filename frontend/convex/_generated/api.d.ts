/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as auth from "../auth.js";
import type * as dashboard from "../dashboard.js";
import type * as generalSupplies from "../generalSupplies.js";
import type * as gymItems from "../gymItems.js";
import type * as items from "../items.js";
import type * as needs from "../needs.js";
import type * as resend from "../resend.js";
import type * as roomItems from "../roomItems.js";
import type * as roomTemplates from "../roomTemplates.js";
import type * as rooms from "../rooms.js";
import type * as testing from "../testing.js";
import type * as transactions from "../transactions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  auth: typeof auth;
  dashboard: typeof dashboard;
  generalSupplies: typeof generalSupplies;
  gymItems: typeof gymItems;
  items: typeof items;
  needs: typeof needs;
  resend: typeof resend;
  roomItems: typeof roomItems;
  roomTemplates: typeof roomTemplates;
  rooms: typeof rooms;
  testing: typeof testing;
  transactions: typeof transactions;
  users: typeof users;
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
