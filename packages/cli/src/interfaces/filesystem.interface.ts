/**
 * FileSystem Service Interface
 *
 * Abstracts file system operations.
 * Enables testing with in-memory filesystem or mocks.
 */

export interface FileStat {
  mode: number;
  isFile(): boolean;
  isDirectory(): boolean;
}

export interface IFileSystemService {
  // Existence checks
  exists(path: string): Promise<boolean>;
  pathExists(path: string): Promise<boolean>;

  // Read operations
  readFile(path: string, encoding?: BufferEncoding): Promise<string>;
  readJson<T = unknown>(path: string): Promise<T>;
  readDir(path: string): Promise<string[]>;

  // Write operations
  writeFile(path: string, content: string, encoding?: BufferEncoding): Promise<void>;
  writeJson(path: string, data: unknown, options?: { spaces?: number }): Promise<void>;

  // Directory operations
  ensureDir(path: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;

  // File info
  stat(path: string): Promise<FileStat>;

  // Path utilities (sync, no I/O)
  join(...paths: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
  resolve(...paths: string[]): string;
  homedir(): string;
}

export const FILESYSTEM_SERVICE_TOKEN = Symbol("FileSystemService");
