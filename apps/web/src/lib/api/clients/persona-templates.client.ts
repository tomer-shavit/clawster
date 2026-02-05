/**
 * Persona Templates domain client.
 * Handles persona template CRUD and injection into bot instances.
 */

import { BaseHttpClient } from '../base-client';
import type {
  PersonaTemplate,
  CreatePersonaTemplatePayload,
  InjectTemplatePayload,
  InjectionResult,
  InjectionStatusResponse,
  RollbackResult,
} from '../types/persona-templates';

export class PersonaTemplatesClient extends BaseHttpClient {
  /**
   * List all persona templates (builtin + custom).
   */
  list(): Promise<PersonaTemplate[]> {
    return this.get('/persona-templates');
  }

  /**
   * Get a single persona template by ID.
   */
  getById(id: string): Promise<PersonaTemplate> {
    return this.get(`/persona-templates/${id}`);
  }

  /**
   * Create a custom persona template.
   */
  create(data: CreatePersonaTemplatePayload): Promise<PersonaTemplate> {
    return this.post('/persona-templates', data);
  }

  /**
   * Delete a custom persona template.
   */
  remove(id: string): Promise<void> {
    return super.delete(`/persona-templates/${id}`);
  }

  /**
   * Inject a persona template into a bot instance.
   */
  inject(
    instanceId: string,
    templateId: string,
    data?: InjectTemplatePayload,
  ): Promise<InjectionResult> {
    return this.post(
      `/persona-templates/inject/${instanceId}/${templateId}`,
      data ?? {},
    );
  }

  /**
   * Get injection status for a bot instance.
   */
  getInjectionStatus(instanceId: string): Promise<InjectionStatusResponse> {
    return this.get(`/persona-templates/status/${instanceId}`);
  }

  /**
   * Rollback template injection on a bot instance.
   */
  rollback(instanceId: string): Promise<RollbackResult> {
    return this.post(`/persona-templates/rollback/${instanceId}`, {});
  }
}

export const personaTemplatesClient = new PersonaTemplatesClient();
