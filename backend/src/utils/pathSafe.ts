import path from 'path';

const normalizeRoot = (root: string): string => {
  const resolvedRoot = path.resolve(root);
  return resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
};

export const ensurePathWithinRoot = (root: string, targetPath: string): string => {
  const normalizedRoot = normalizeRoot(root);
  const resolvedTarget = path.resolve(targetPath);
  const relative = path.relative(normalizedRoot, resolvedTarget);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path traversal detected: ${targetPath}`);
  }

  return resolvedTarget;
};

export const resolveWithinRoot = (root: string, ...segments: string[]): string => {
  const normalizedRoot = normalizeRoot(root);
  const resolved = path.resolve(normalizedRoot, ...segments);
  return ensurePathWithinRoot(normalizedRoot, resolved);
};
