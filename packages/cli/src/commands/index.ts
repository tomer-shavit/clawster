/**
 * Commands Index
 *
 * Exports command registration and handlers.
 */

export { registerCommands } from "./register";

// Doctor command
export { DoctorHandler, createDoctorHandler } from "./doctor";
export type { DoctorOptions } from "./doctor";

// Setup command
export { SetupHandler, createSetupHandler } from "./setup";
export type { SetupOptions } from "./setup";

// Bootstrap command
export { BootstrapHandler, createBootstrapHandler } from "./bootstrap";
export type { BootstrapOptions } from "./bootstrap";

// Status command
export { StatusHandler, createStatusHandler } from "./status";
export type { StatusOptions } from "./status";

// Sysbox commands
export {
  SysboxStatusHandler,
  SysboxInstallHandler,
  createSysboxStatusHandler,
  createSysboxInstallHandler,
} from "./sysbox";

// Provider commands
export { ProviderListHandler, createProviderListHandler } from "./provider";

// Database commands
export { DbHandler, createDbHandler } from "./db";

// Development commands
export { DevHandler, createDevHandler } from "./dev";
