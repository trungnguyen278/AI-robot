// SPDX-License-Identifier: MIT
/* Emotion kind-tagging.

   Historically this file also defined the base scene categories, but those
   are now authored entirely by the scenes-arc-pack-* files (which load
   last). All that remains here is the side-effect that tags every
   already-registered category as kind:'emotion', so the host can filter
   emotions vs scenes vs status.

   Loaded AFTER emotion-extras.jsx, BEFORE the scene/status packs.
*/

const cats = window.EMOTION_CATEGORIES;

// Tag everything defined so far as an emotion. The scene + status packs set
// their own `kind` explicitly when they register their categories.
for (const k of Object.keys(cats)) {
  if (!cats[k].kind) cats[k].kind = 'emotion';
}
