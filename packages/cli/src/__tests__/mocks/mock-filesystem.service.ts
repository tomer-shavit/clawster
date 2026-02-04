/**
 * Mock FileSystem Service
 *
 * In-memory filesystem for testing.
 */

import path from "path";
import os from "os";
import type { IFileSystemService, FileStat } from "../../interfaces/filesystem.interface";

export class MockFileSystemService implements IFileSystemService {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  constructor() {
    // Initialize with root directory
    this.directories.add("/");
  }

  // Existence checks
  async exists(filePath: string): Promise<boolean> {
    return this.files.has(filePath) || this.directories.has(filePath);
  }

  async pathExists(filePath: string): Promise<boolean> {
    return this.exists(filePath);
  }

  // Read operations
  async readFile(filePath: string, _encoding?: BufferEncoding): Promise<string> {
    const content = this.files.get(filePath);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    }
    return content;
  }

  async readJson<T = unknown>(filePath: string): Promise<T> {
    const content = await this.readFile(filePath);
    return JSON.parse(content) as T;
  }

  async readDir(dirPath: string): Promise<string[]> {
    if (!this.directories.has(dirPath)) {
      throw new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`);
    }

    const entries: string[] = [];
    const prefix = dirPath.endsWith("/") ? dirPath : `${dirPath}/`;

    // Find files in this directory
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix)) {
        const relative = filePath.slice(prefix.length);
        if (!relative.includes("/")) {
          entries.push(relative);
        }
      }
    }

    // Find subdirectories
    for (const subDir of this.directories) {
      if (subDir.startsWith(prefix) && subDir !== dirPath) {
        const relative = subDir.slice(prefix.length);
        if (!relative.includes("/")) {
          entries.push(relative);
        }
      }
    }

    return entries;
  }

  // Write operations
  async writeFile(
    filePath: string,
    content: string,
    _encoding?: BufferEncoding
  ): Promise<void> {
    this.files.set(filePath, content);
    // Ensure parent directory exists
    this.directories.add(path.dirname(filePath));
  }

  async writeJson(
    filePath: string,
    data: unknown,
    options?: { spaces?: number }
  ): Promise<void> {
    const content = JSON.stringify(data, null, options?.spaces ?? 2);
    await this.writeFile(filePath, content);
  }

  // Directory operations
  async ensureDir(dirPath: string): Promise<void> {
    this.directories.add(dirPath);
  }

  async mkdir(dirPath: string, _options?: { recursive?: boolean }): Promise<void> {
    this.directories.add(dirPath);
  }

  // File info
  async stat(filePath: string): Promise<FileStat> {
    const isDir = this.directories.has(filePath);
    const isFile = this.files.has(filePath);

    if (!isDir && !isFile) {
      throw new Error(`ENOENT: no such file or directory, stat '${filePath}'`);
    }

    // Default mode: 644 for files, 755 for directories
    const defaultMode = isDir ? 0o755 : 0o644;

    return {
      mode: this.getFileMode(filePath) ?? defaultMode,
      isFile: () => isFile,
      isDirectory: () => isDir,
    };
  }

  // Path utilities
  join(...paths: string[]): string {
    return path.join(...paths);
  }

  dirname(filePath: string): string {
    return path.dirname(filePath);
  }

  basename(filePath: string): string {
    return path.basename(filePath);
  }

  resolve(...paths: string[]): string {
    return path.resolve(...paths);
  }

  homedir(): string {
    return os.homedir();
  }

  // Test helpers
  private fileModes: Map<string, number> = new Map();

  setFile(filePath: string, content: string, mode?: number): void {
    this.files.set(filePath, content);
    this.directories.add(path.dirname(filePath));
    if (mode !== undefined) {
      this.fileModes.set(filePath, mode);
    }
  }

  setDirectory(dirPath: string): void {
    this.directories.add(dirPath);
  }

  setFileMode(filePath: string, mode: number): void {
    this.fileModes.set(filePath, mode);
  }

  getFileMode(filePath: string): number | undefined {
    return this.fileModes.get(filePath);
  }

  getFile(filePath: string): string | undefined {
    return this.files.get(filePath);
  }

  hasFile(filePath: string): boolean {
    return this.files.has(filePath);
  }

  hasDirectory(dirPath: string): boolean {
    return this.directories.has(dirPath);
  }

  clear(): void {
    this.files.clear();
    this.directories.clear();
    this.fileModes.clear();
    this.directories.add("/");
  }
}
