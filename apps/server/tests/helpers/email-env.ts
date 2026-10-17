/**
 * Import this FIRST in an email test. It only fills in placeholder values so modules that read the
 * environment at load time can be imported. It opens no database connection and no mail connection.
 */
process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-at-least-32-characters";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-at-least-32-characters";
process.env.APP_WEB_URL ??= "https://nexus.example.org";

export {};
