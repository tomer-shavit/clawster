/**
 * Prompts Service Interface
 *
 * Abstracts interactive prompts.
 * Enables testing with pre-configured responses.
 */

export interface SelectChoice<T = string> {
  name: string;
  value: T;
  disabled?: boolean | string;
}

export interface IPromptsService {
  /**
   * Ask a yes/no confirmation question.
   */
  confirm(message: string, defaultValue?: boolean): Promise<boolean>;

  /**
   * Ask for text input.
   */
  input(message: string, defaultValue?: string): Promise<string>;

  /**
   * Ask for password input (hidden).
   */
  password(message: string): Promise<string>;

  /**
   * Ask user to select from a list of choices.
   */
  select<T = string>(
    message: string,
    choices: SelectChoice<T>[]
  ): Promise<T>;

  /**
   * Ask user to select multiple items from a list.
   */
  multiSelect<T = string>(
    message: string,
    choices: SelectChoice<T>[]
  ): Promise<T[]>;

  /**
   * Whether prompts are running in non-interactive mode.
   * In non-interactive mode, default values are returned without prompting.
   */
  isNonInteractive(): boolean;

  /**
   * Set non-interactive mode.
   */
  setNonInteractive(value: boolean): void;
}

export const PROMPTS_SERVICE_TOKEN = Symbol("PromptsService");
