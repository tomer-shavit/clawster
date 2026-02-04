/**
 * Mock Prompts Service
 *
 * Pre-configured prompt responses for testing.
 */

import type { IPromptsService, SelectChoice } from "../../interfaces/prompts.interface";

export class MockPromptsService implements IPromptsService {
  private confirmResponses: Map<string, boolean> = new Map();
  private inputResponses: Map<string, string> = new Map();
  private selectResponses: Map<string, unknown> = new Map();
  private multiSelectResponses: Map<string, unknown[]> = new Map();
  private nonInteractive = false;
  private promptHistory: Array<{ type: string; message: string; response: unknown }> = [];

  async confirm(message: string, defaultValue = false): Promise<boolean> {
    if (this.nonInteractive) {
      this.promptHistory.push({ type: "confirm", message, response: defaultValue });
      return defaultValue;
    }

    const response = this.confirmResponses.get(message) ?? defaultValue;
    this.promptHistory.push({ type: "confirm", message, response });
    return response;
  }

  async input(message: string, defaultValue = ""): Promise<string> {
    if (this.nonInteractive) {
      this.promptHistory.push({ type: "input", message, response: defaultValue });
      return defaultValue;
    }

    const response = this.inputResponses.get(message) ?? defaultValue;
    this.promptHistory.push({ type: "input", message, response });
    return response;
  }

  async password(message: string): Promise<string> {
    if (this.nonInteractive) {
      this.promptHistory.push({ type: "password", message, response: "" });
      return "";
    }

    const response = this.inputResponses.get(message) ?? "";
    this.promptHistory.push({ type: "password", message, response: "[hidden]" });
    return response;
  }

  async select<T = string>(
    message: string,
    choices: SelectChoice<T>[]
  ): Promise<T> {
    if (this.nonInteractive) {
      const firstEnabled = choices.find((c) => !c.disabled);
      if (!firstEnabled) {
        throw new Error("No enabled choices available");
      }
      this.promptHistory.push({ type: "select", message, response: firstEnabled.value });
      return firstEnabled.value;
    }

    const response = this.selectResponses.get(message);
    if (response !== undefined) {
      this.promptHistory.push({ type: "select", message, response });
      return response as T;
    }

    // Return first enabled choice
    const firstEnabled = choices.find((c) => !c.disabled);
    if (!firstEnabled) {
      throw new Error("No enabled choices available");
    }
    this.promptHistory.push({ type: "select", message, response: firstEnabled.value });
    return firstEnabled.value;
  }

  async multiSelect<T = string>(
    message: string,
    choices: SelectChoice<T>[]
  ): Promise<T[]> {
    if (this.nonInteractive) {
      const enabledChoices = choices.filter((c) => !c.disabled).map((c) => c.value);
      this.promptHistory.push({ type: "multiSelect", message, response: enabledChoices });
      return enabledChoices;
    }

    const response = this.multiSelectResponses.get(message);
    if (response !== undefined) {
      this.promptHistory.push({ type: "multiSelect", message, response });
      return response as T[];
    }

    // Return all enabled choices
    const enabledChoices = choices.filter((c) => !c.disabled).map((c) => c.value);
    this.promptHistory.push({ type: "multiSelect", message, response: enabledChoices });
    return enabledChoices;
  }

  isNonInteractive(): boolean {
    return this.nonInteractive;
  }

  setNonInteractive(value: boolean): void {
    this.nonInteractive = value;
  }

  // Test helpers
  setConfirmResponse(message: string, response: boolean): void {
    this.confirmResponses.set(message, response);
  }

  setInputResponse(message: string, response: string): void {
    this.inputResponses.set(message, response);
  }

  setSelectResponse<T>(message: string, response: T): void {
    this.selectResponses.set(message, response);
  }

  setMultiSelectResponse<T>(message: string, response: T[]): void {
    this.multiSelectResponses.set(message, response);
  }

  getPromptHistory(): Array<{ type: string; message: string; response: unknown }> {
    return [...this.promptHistory];
  }

  wasPromptShown(message: string): boolean {
    return this.promptHistory.some((p) => p.message === message);
  }

  clear(): void {
    this.confirmResponses.clear();
    this.inputResponses.clear();
    this.selectResponses.clear();
    this.multiSelectResponses.clear();
    this.promptHistory = [];
    this.nonInteractive = false;
  }
}
