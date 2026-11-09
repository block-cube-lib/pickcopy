// Background service worker.
//
// Currently no background work is needed: the extension action always
// shows its popup (see "action.default_popup" in manifest.json), so the
// former declarativeContent rule was removed. This entry point is kept
// as the manifest's service worker for future use.
export {};
