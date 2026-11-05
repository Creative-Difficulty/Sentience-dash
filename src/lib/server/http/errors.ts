// Turning unexpected (database) errors into something safe to show users.

export const GENERIC_LOAD_ERROR = 'Could not load data. The error has been logged on the server.';

/**
 * Logs the real error server-side and returns the generic payload the pages
 * render in their error toast. Never send `e.toString()` to the client: for a
 * failed query it contains the full SQL text and parameters.
 */
export function loadFailed(
	where: string,
	e: unknown,
	log: (...args: unknown[]) => void = console.error
) {
	log(`[${where}] load failed:`, e);
	return { error: GENERIC_LOAD_ERROR };
}
