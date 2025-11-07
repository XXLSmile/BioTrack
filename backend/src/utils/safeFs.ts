import fs from 'fs';

const applyFsMethod = <Args extends unknown[], Result>(
  method: (...args: Args) => Result,
  args: Args
): Result => Reflect.apply(method, fs, args);

export const ensureDirSync = (directory: string): void => {
  applyFsMethod(fs.mkdirSync, [directory, { recursive: true }]);
};

export const existsSync = (filepath: string): boolean =>
  applyFsMethod(fs.existsSync, [filepath]);

export const readFileBufferSync = (filepath: string): Buffer =>
  applyFsMethod(fs.readFileSync, [filepath]) as Buffer;

export const writeFileSync = (filepath: string, data: Buffer): void => {
  applyFsMethod(fs.writeFileSync, [filepath, data]);
};

export const renameSync = (source: string, destination: string): void => {
  applyFsMethod(fs.renameSync, [source, destination]);
};

export const unlinkSync = (filepath: string): void => {
  applyFsMethod(fs.unlinkSync, [filepath]);
};
