// Custom column types for the drizzle mirror of the unidb schema.
// Kept out of schema.ts so that module only exports tables and enums.
import { customType } from 'drizzle-orm/pg-core';

/**
 * Discord snowflake stored as int8. Snowflakes exceed Number.MAX_SAFE_INTEGER,
 * so they are kept as decimal strings end to end (postgres-js already returns
 * int8 as a string). Never convert them with Number().
 */
export const snowflake = customType<{ data: string; driverData: string }>({
	dataType() {
		return 'bigint';
	},
	fromDriver(value) {
		return String(value);
	},
	toDriver(value) {
		return value;
	}
});

/**
 * pgvector column declared without dimensions in unidb (`vector`), which
 * drizzle's built-in vector() cannot express (it always emits vector(N)).
 */
export const embedding = customType<{ data: number[]; driverData: string }>({
	dataType() {
		return 'vector';
	},
	fromDriver(value) {
		return JSON.parse(value) as number[];
	},
	toDriver(value) {
		return JSON.stringify(value);
	}
});

/** Raw bytes (e.g. generated diagram images). */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType() {
		return 'bytea';
	}
});
