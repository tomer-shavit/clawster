/**
 * Prompts Service Implementation
 *
 * Wraps inquirer for interactive prompts.
 */

import inquirer from "inquirer";
import type { IPromptsService, SelectChoice } from "../interfaces/prompts.interface";

export class PromptsService implements IPromptsService {
  private nonInteractive = false;

  async confirm(message: string, defaultValue = false): Promise<boolean> {
    if (this.nonInteractive) {
      return defaultValue;
    }

    const { result } = await inquirer.prompt([
      {
        type: "confirm",
        name: "result",
        message,
        default: defaultValue,
      },
    ]);

    return result;
  }

  async input(message: string, defaultValue = ""): Promise<string> {
    if (this.nonInteractive) {
      return defaultValue;
    }

    const { result } = await inquirer.prompt([
      {
        type: "input",
        name: "result",
        message,
        default: defaultValue,
      },
    ]);

    return result;
  }

  async password(message: string): Promise<string> {
    if (this.nonInteractive) {
      return "";
    }

    const { result } = await inquirer.prompt([
      {
        type: "password",
        name: "result",
        message,
        mask: "*",
      },
    ]);

    return result;
  }

  async select<T = string>(
    message: string,
    choices: SelectChoice<T>[]
  ): Promise<T> {
    if (this.nonInteractive) {
      // Return first non-disabled choice
      const firstEnabled = choices.find((c) => !c.disabled);
      if (firstEnabled) {
        return firstEnabled.value;
      }
      throw new Error("No enabled choices available in non-interactive mode");
    }

    const { result } = await inquirer.prompt([
      {
        type: "list",
        name: "result",
        message,
        choices: choices.map((c) => ({
          name: c.name,
          value: c.value,
          disabled: c.disabled,
        })),
      },
    ]);

    return result;
  }

  async multiSelect<T = string>(
    message: string,
    choices: SelectChoice<T>[]
  ): Promise<T[]> {
    if (this.nonInteractive) {
      // Return all non-disabled choices
      return choices.filter((c) => !c.disabled).map((c) => c.value);
    }

    const { result } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "result",
        message,
        choices: choices.map((c) => ({
          name: c.name,
          value: c.value,
          disabled: c.disabled,
        })),
      },
    ]);

    return result;
  }

  isNonInteractive(): boolean {
    return this.nonInteractive;
  }

  setNonInteractive(value: boolean): void {
    this.nonInteractive = value;
  }
}
