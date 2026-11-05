import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

export type Database = PostgresJsDatabase<typeof schema>;

let instance: Database | undefined;

/**
 * Returns the shared drizzle client, creating it (and its connection pool) on
 * first use.
 *
 * The client must not be created at import time: `vite build` imports every
 * server module while analysing the app, when no DATABASE_URL exists (e.g. in
 * `docker build`). A missing DATABASE_URL therefore throws here, at request
 * time, instead of breaking the build.
 */
export function getDb(): Database {
	if (instance) return instance;
	const url = env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL is not set');
	instance = drizzle(postgres(url), { schema });
	return instance;
}

/**
 * Lazily-initialised drizzle client: same API as the object returned by
 * `drizzle()`, but nothing connects until a property is first accessed.
 */
export const db: Database = new Proxy({} as Database, {
	get(_target, prop) {
		const real = getDb();
		const value = Reflect.get(real, prop, real);
		return typeof value === 'function' ? value.bind(real) : value;
	},
	has(_target, prop) {
		return Reflect.has(getDb(), prop);
	}
});
