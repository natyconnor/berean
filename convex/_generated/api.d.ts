/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as esv from "../esv.js";
import type * as feedback from "../feedback.js";
import type * as gospelParallels from "../gospelParallels.js";
import type * as highlights from "../highlights.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_deleteAccount from "../lib/deleteAccount.js";
import type * as lib_noteContent from "../lib/noteContent.js";
import type * as lib_publicValues from "../lib/publicValues.js";
import type * as lib_seed_devSeedSupport from "../lib/seed/devSeedSupport.js";
import type * as lib_tags from "../lib/tags.js";
import type * as lib_tutorial from "../lib/tutorial.js";
import type * as lib_verseRefs from "../lib/verseRefs.js";
import type * as noteTransfer from "../noteTransfer.js";
import type * as noteVerseLinks from "../noteVerseLinks.js";
import type * as notes from "../notes.js";
import type * as savedVerses from "../savedVerses.js";
import type * as seed from "../seed.js";
import type * as tags from "../tags.js";
import type * as userSettings from "../userSettings.js";
import type * as users from "../users.js";
import type * as verseLinks from "../verseLinks.js";
import type * as verseRefs from "../verseRefs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  esv: typeof esv;
  feedback: typeof feedback;
  gospelParallels: typeof gospelParallels;
  highlights: typeof highlights;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/deleteAccount": typeof lib_deleteAccount;
  "lib/noteContent": typeof lib_noteContent;
  "lib/publicValues": typeof lib_publicValues;
  "lib/seed/devSeedSupport": typeof lib_seed_devSeedSupport;
  "lib/tags": typeof lib_tags;
  "lib/tutorial": typeof lib_tutorial;
  "lib/verseRefs": typeof lib_verseRefs;
  noteTransfer: typeof noteTransfer;
  noteVerseLinks: typeof noteVerseLinks;
  notes: typeof notes;
  savedVerses: typeof savedVerses;
  seed: typeof seed;
  tags: typeof tags;
  userSettings: typeof userSettings;
  users: typeof users;
  verseLinks: typeof verseLinks;
  verseRefs: typeof verseRefs;
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
