export const sanitizeArgs = (args: unknown[]): unknown[] => {
  return args.map(arg => (typeof arg === 'string' ? sanitizeInput(arg) : arg));
};

export const sanitizeInput = (input: string): string => {
  return input.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
};
