// Vitest doesn't apply Next.js' webpack aliases. In app code we rely on
// `import "server-only";` to prevent client bundles from importing server
// modules. During unit tests we only need the import to resolve.

export {};
