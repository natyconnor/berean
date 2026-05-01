# Changelog

## [1.7.0](https://github.com/natyconnor/berean/compare/v1.6.1...v1.7.0) (2026-05-01)


### Features

* Nathanc/study mode v1 ([#65](https://github.com/natyconnor/berean/issues/65)) ([2ec9be3](https://github.com/natyconnor/berean/commit/2ec9be3912931608d264a70c1e2cd77488934d93))

## [1.6.1](https://github.com/natyconnor/berean/compare/v1.6.0...v1.6.1) (2026-04-13)


### Bug Fixes

* allow the user to type chapter numbers when navigating ([#60](https://github.com/natyconnor/berean/issues/60)) ([6a217a6](https://github.com/natyconnor/berean/commit/6a217a6c731810e85f218a3a1cfeaccdd504c716))

## [1.6.0](https://github.com/natyconnor/berean/compare/v1.5.2...v1.6.0) (2026-04-10)


### Features

* create saved verses table and add heart interaction to save verses or passages as hearted. Still working on the UX for passages ([c9a7ecd](https://github.com/natyconnor/berean/commit/c9a7ecd4bd0e48926c4e17b3b0500154df2a70fc))

## [1.5.2](https://github.com/natyconnor/berean/compare/v1.5.1...v1.5.2) (2026-04-09)


### Bug Fixes

* hovering over a single verse only highlights the verse, even if it's an anchor verse for a passage note. Hovering over the passage note highlights the whole passage (including the anchor verse) ([04b2f60](https://github.com/natyconnor/berean/commit/04b2f60e80cf2ce8c59739b6891950aa3ad25dd5))

## [1.5.1](https://github.com/natyconnor/berean/compare/v1.5.0...v1.5.1) (2026-04-02)


### Bug Fixes

* use vercel headers to enforce proper refresh when refresh button is clicked ([#49](https://github.com/natyconnor/berean/issues/49)) ([e191e49](https://github.com/natyconnor/berean/commit/e191e495157958f909db2565d0d099051e3b5ab0))

## [1.5.0](https://github.com/natyconnor/berean/compare/v1.4.1...v1.5.0) (2026-04-02)


### Features

* add a build id from vercel deploy or git sha and use to compare to see if client is out of date. Show refresh message if so ([#46](https://github.com/natyconnor/berean/issues/46)) ([5b4df2f](https://github.com/natyconnor/berean/commit/5b4df2f2a60e72ddfe8f13fff86e11000c295056))

## [1.4.1](https://github.com/natyconnor/berean/compare/v1.4.0...v1.4.1) (2026-03-30)


### Bug Fixes

* update note tag field to not be as wide so note controls can be seen when dropdown is open. Also ensure that modifiers with Enter don't get registered as Enter to select a tag from the dropdown ([#42](https://github.com/natyconnor/berean/issues/42)) ([309b220](https://github.com/natyconnor/berean/commit/309b220d25a803a173c0f322758ebdc159629bce))

## [1.4.0](https://github.com/natyconnor/berean/compare/v1.3.2...v1.4.0) (2026-03-30)


### Features

* implement optimizations for esv passage fetching for search so we don't get blocked for large search results: ([#40](https://github.com/natyconnor/berean/issues/40)) ([f024b5c](https://github.com/natyconnor/berean/commit/f024b5c8361ddfdb5cac682d9eb9779bd7d9e50c))

## [1.3.2](https://github.com/natyconnor/berean/compare/v1.3.1...v1.3.2) (2026-03-30)


### Bug Fixes

* update react-refresh eslint to new version which now requires routes/ folder and update app so all routes are within there and follow new component export rule ([#37](https://github.com/natyconnor/berean/issues/37)) ([fe2aa06](https://github.com/natyconnor/berean/commit/fe2aa06cf92dd64252c571b70bab6594af8cf739))

## [1.3.1](https://github.com/natyconnor/berean/compare/v1.3.0...v1.3.1) (2026-03-30)


### Bug Fixes

* fix skipping tutorial going to settings page and going back from settings page tutorial steps jumping back to step 1 ([#22](https://github.com/natyconnor/berean/issues/22)) ([ba6b2dd](https://github.com/natyconnor/berean/commit/ba6b2dda9817b8eba078c8491873abd325824b21))

## [1.3.0](https://github.com/natyconnor/berean/compare/v1.2.0...v1.3.0) (2026-03-28)


### Features

* set up anonymous auth for vercel preview env ([88796bb](https://github.com/natyconnor/berean/commit/88796bbc0ecf9c4edeb8a53171c067d07e4c0fe9))
* set up release-please ([e3f844b](https://github.com/natyconnor/berean/commit/e3f844b4d25ac4ba0c24d27ef06cb0139b747841))

## [1.2.0](https://github.com/natyconnor/berean/compare/v1.1.0...v1.2.0) (2026-03-28)


### Features

* set up anonymous auth for vercel preview env ([88796bb](https://github.com/natyconnor/berean/commit/88796bbc0ecf9c4edeb8a53171c067d07e4c0fe9))
* set up release-please ([e3f844b](https://github.com/natyconnor/berean/commit/e3f844b4d25ac4ba0c24d27ef06cb0139b747841))

## [1.1.0](https://github.com/natyconnor/berean/compare/v1.0.0...v1.1.0) (2026-03-28)


### Features

* set up anonymous auth for vercel preview env ([88796bb](https://github.com/natyconnor/berean/commit/88796bbc0ecf9c4edeb8a53171c067d07e4c0fe9))
* set up release-please ([e3f844b](https://github.com/natyconnor/berean/commit/e3f844b4d25ac4ba0c24d27ef06cb0139b747841))

## 1.0.0 (2026-03-28)


### Features

* set up release-please ([e3f844b](https://github.com/natyconnor/berean/commit/e3f844b4d25ac4ba0c24d27ef06cb0139b747841))
