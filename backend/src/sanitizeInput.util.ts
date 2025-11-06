export const sanitizeArgs = (args: unknown[]): unknown[] => {
  return args.map(arg => sanitizeInput(String(arg)));
};

export const sanitizeInput = (input: string): string => {
  return input.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
};
