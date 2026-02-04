/**
 * FileSystem Service Implementation
 *
 * Wraps fs-extra and path for file system operations.
 */

import fs from "fs-extra";
import path from "path";
import os from "os";
import type { IFileSystemService, FileStat } from "../interfaces/filesystem.interface";

export class FileSystemService implements IFileSystemService {
  // Existence checks
  async exists(filePath: string): Promise<boolean> {
    return fs.pathExists(filePath);
  }

  async pathExists(filePath: string): Promise<boolean> {
    return fs.pathExists(filePath);
  }

  // Read operations
  async readFile(filePath: string, encoding: BufferEncoding = "utf-8"): Promise<string> {
    return fs.readFile(filePath, encoding);
  }

  async readJson<T = unknown>(filePath: string): Promise<T> {
    return fs.readJson(filePath);
  }

  async readDir(dirPath: string): Promise<string[]> {
    return fs.readdir(dirPath);
  }

  // Write operations
  async writeFile(
    filePath: string,
    content: string,
    encoding: BufferEncoding = "utf-8"
  ): Promise<void> {
    await fs.writeFile(filePath, content, encoding);
  }

  async writeJson(
    filePath: string,
    data: unknown,
    options?: { spaces?: number }
  ): Promise<void> {
    await fs.writeJson(filePath, data, { spaces: options?.spaces ?? 2 });
  }

  // Directory operations
  async ensureDir(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.mkdir(dirPath, options);
  }

  // File info
  async stat(filePath: string): Promise<FileStat> {
    const stats = await fs.stat(filePath);
    return {
      mode: stats.mode,
      isFile: () => stats.isFile(),
      isDirectory: () => stats.isDirectory(),
    };
  }

  // Path utilities (sync, no I/O)
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
}
