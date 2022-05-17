/** one instance of matcher, don't create a new one every time (probably microoptimisation) */
export const matcher_prefers_dark = matchMedia("(prefers-color-scheme: dark)");

/**
 * either light or dark, represents the actual colour schemes
 * that can be presented on the UI
 */
export type ColourScheme =
	| "light"
	| "dark";

/**
 * either light, dark, or system, represents the settings that are stored.
 * system means that light/dark is picked based on the system preference.
 */
export type ColourSchemeSetting =
	| "light"
	| "dark"
	| "system";

export type WatchCallback = (s: ColourScheme) => void;
export type MediaQueryCallback = (e: MediaQueryListEvent) => void;

export type DarkModeHelper<S extends "sync" | "async", W extends boolean = false> = {
	/** gets the mode that should be used, either "light" or "dark" */
	get: S extends "sync"
		? () => ColourScheme
		: () => Promise<ColourScheme>;

	/** gets the setting that is set, either "light", "dark", or "system" */
	get_setting: S extends "sync"
		? () => ColourSchemeSetting
		: () => Promise<ColourSchemeSetting>;

	/** changes the setting to one of "light", "dark", or "system" */
	set: S extends "sync"
		? (s: ColourSchemeSetting) => void
		: (s: ColourSchemeSetting) => Promise<void>;
} & (W extends true ? {
	/**
	 * register a listener for when the setting changes.
	 * Provide a key for more convenient unregistering.
	 */
	watch: {
		(cb: WatchCallback): void;
		(key: string, cb: WatchCallback): void;
	};

	/**
	 * remove a listener function previously registered,
	 * either by function or previously provided key
	 */
	unwatch: {
		(cb: WatchCallback): void;
		(key: string): void;
	};
} : {});

/** queries the system for its preferred colour scheme, either "light" or "dark" */
export function get_system_preference(): ColourScheme {
	return matcher_prefers_dark.matches ? "dark" : "light";
}

export function setting_to_mode(s: ColourSchemeSetting) {
	return s === "system" ? get_system_preference() : s;
}

export function create_matcher_event_listener_sync(
	get_setting: DarkModeHelper<"sync">["get_setting"],
	watch_cb: WatchCallback
): MediaQueryCallback {
	return (event: MediaQueryListEvent) => watch_cb(setting_to_mode(get_setting()));
}

export function create_matcher_event_listener_async(
	get_setting: DarkModeHelper<"async">["get_setting"],
	watch_cb: WatchCallback
): MediaQueryCallback {
	return (event: MediaQueryListEvent) => get_setting()
		.then(setting_to_mode)
		.then(watch_cb);
}

export function create_event_listener_store<S extends "sync" | "async">(
	type: S,
	get_setting: DarkModeHelper<S>["get_setting"]
) {
	let stored_fns: Array<[
		WatchCallback,
		MediaQueryCallback,
		string?
	]> = [];

	return { store_function, get_function };

	function store_function(watch_cb: WatchCallback, key?: string): MediaQueryCallback {
		let media_query_cb = type === "sync"
			? create_matcher_event_listener_sync(get_setting as any, watch_cb)
			: create_matcher_event_listener_async(get_setting as any, watch_cb);

		key
			? stored_fns.push([watch_cb, media_query_cb, key])
			: stored_fns.push([watch_cb, media_query_cb]);

		return media_query_cb;
	}

	function get_function(fn: WatchCallback | string) {
		return typeof fn === "string"
			? stored_fns.find(sf => fn === sf[2])?.[1]
			: stored_fns.find(sf => fn === sf[0])?.[1];
	}
}