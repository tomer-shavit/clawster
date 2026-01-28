#!/usr/bin/env node

import { Command } from "commander";
import { bootstrap } from "./commands/bootstrap";
import { status } from "./commands/status";
import { doctor } from "./commands/doctor";
import { MOLTHUB_VERSION } from "@molthub/core";

const program = new Command();

program
  .name("molthub")
  .description("Molthub CLI - Control plane for Moltbot instances")
  .version(MOLTHUB_VERSION);

program
  .command("bootstrap")
  .description("Bootstrap Molthub infrastructure in your AWS account")
  .option("--region <region>", "AWS region", "us-east-1")
  .option("--workspace <name>", "Workspace name", "default")
  .action(bootstrap);

program
  .command("status")
  .description("Check Molthub status and instance health")
  .action(status);

program
  .command("doctor")
  .description("Diagnose common issues with Molthub setup")
  .action(doctor);

program.parse();