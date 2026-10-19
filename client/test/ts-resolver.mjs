// The client sources import each other without a file extension (the bundler adds it); this lets
// Node's test runner load the same files (Node strips the TypeScript types itself).
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context);
    throw error;
  }
}
