export const VERSION = '0.1.0';

export interface Fleet {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

export interface BotTemplate {
  id: string;
  name: string;
  description?: string;
  version: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bot {
  id: string;
  name: string;
  description?: string;
  status: 'IDLE' | 'RUNNING' | 'ERROR' | 'STOPPED';
  config: Record<string, unknown>;
  fleetId: string;
  templateId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ApiResponse<T> = {
  data: T;
  success: boolean;
  message?: string;
};

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
