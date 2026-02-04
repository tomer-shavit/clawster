/**
 * Doctor Command Module
 *
 * Exports doctor command components.
 */

export { DoctorHandler, createDoctorHandler } from "./doctor.handler";
export { CheckRunner, type DoctorOptions } from "./check-runner";
export { CheckRegistry, type CheckFilter } from "./check-registry";
export type { IDoctorCheck, CheckResult, CheckContext } from "./checks/check.interface";
