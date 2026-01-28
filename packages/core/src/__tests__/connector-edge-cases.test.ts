import { describe, it, expect, beforeEach } from 'vitest';
import {
  IntegrationConnectorSchema,
  ConnectorRefSchema,
  BotConnectorBindingSchema,
  ConnectionTestResultSchema,
  validateIntegrationConnector,
  validateConnectorRef,
  validateBotConnectorBinding,
} from '../connector';
import { createConnector, resetIdCounter } from './fixtures';
import { deepClone } from './utils';

describe('Connector - Edge Cases and Boundary Conditions', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('name validation', () => {
    it('rejects empty name', () => {
      const connector = createConnector({ name: '' });
      expect(() => validateIntegrationConnector(connector)).toThrow();
    });

    it('rejects name with only whitespace', () => {
      const connector = createConnector({ name: '   ' });
      expect(() => validateIntegrationConnector(connector)).toThrow();
    });

    it('rejects name longer than 128 characters', () => {
      const connector = createConnector({ name: 'A'.repeat(129) });
      expect(() => validateIntegrationConnector(connector)).toThrow();
    });

    it('accepts name at exactly 128 characters', () => {
      const connector = createConnector({ name: 'A'.repeat(128) });
      expect(() => validateIntegrationConnector(connector)).not.toThrow();
    });

    it('accepts names with special characters', () => {
      const validNames = [
        'OpenAI Production',
        'Slack (Internal)',
        'AWS - US-East-1',
        'Database: PostgreSQL',
        'GitHub [Enterprise]',
      ];

      for (const name of validNames) {
        const connector = createConnector({ name });
        expect(() => validateIntegrationConnector(deepClone(connector))).not.toThrow();
      }
    });
  });

  describe('description validation', () => {
    it('accepts undefined description', () => {
      const connector = createConnector({ description: undefined });
      const result = validateIntegrationConnector(connector);
      expect(result.description).toBeUndefined();
    });

    it('accepts empty description', () => {
      const connector = createConnector({ description: '' });
      const result = validateIntegrationConnector(connector);
      expect(result.description).toBe('');
    });

    it('accepts description up to 2000 characters', () => {
      const connector = createConnector({
        description: 'A'.repeat(2000),
      });
      const result = validateIntegrationConnector(connector);
      expect(result.description).toHaveLength(2000);
    });

    it('rejects description longer than 2000 characters', () => {
      const connector = createConnector({
        description: 'A'.repeat(2001),
      });
      expect(() => validateIntegrationConnector(connector)).toThrow();
    });
  });

  describe('type validation', () => {
    it('accepts all valid connector types', () => {
      const validTypes = [
        'openai',
        'anthropic',
        'gemini',
        'azure_openai',
        'cohere',
        'ollama',
        'slack',
        'discord',
        'telegram',
        'teams',
        'webhook',
        'email',
        'aws',
        'gcp',
        'azure',
        'postgres',
        'mysql',
        'mongodb',
        'redis',
        'github',
        'gitlab',
        'jira',
        'notion',
        'custom',
      ];

      for (const type of validTypes) {
        const connector = createConnector({ type });
        const result = validateIntegrationConnector(deepClone(connector));
        expect(result.type).toBe(type);
      }
    });

    it('rejects invalid connector types', () => {
      const invalidTypes = [
        'invalid',
        'unknown',
        'test',
        '',
        'OPENAI',
        'OpenAI',
      ];

      for (const type of invalidTypes) {
        const connector = createConnector({ type: type as any });
        expect(() => validateIntegrationConnector(deepClone(connector))).toThrow();
      }
    });
  });

  describe('status validation', () => {
    it('defaults status to PENDING', () => {
      const connector = createConnector();
      delete (connector as any).status;
      const result = IntegrationConnectorSchema.parse(connector);
      expect(result.status).toBe('PENDING');
    });

    it('accepts all valid statuses', () => {
      const statuses = ['ACTIVE', 'INACTIVE', 'ERROR', 'PENDING'];

      for (const status of statuses) {
        const connector = createConnector({ status: status as any });
        const result = validateIntegrationConnector(deepClone(connector));
        expect(result.status).toBe(status);
      }
    });
  });

  describe('shared connector validation', () => {
    it('defaults isShared to true', () => {
      const connector = createConnector();
      delete (connector as any).isShared;
      const result = IntegrationConnectorSchema.parse(connector);
      expect(result.isShared).toBe(true);
    });

    it('accepts non-shared connector', () => {
      const connector = createConnector({
        isShared: false,
        allowedInstanceIds: ['bot-1', 'bot-2'],
      });
      const result = validateIntegrationConnector(connector);
      expect(result.isShared).toBe(false);
      expect(result.allowedInstanceIds).toHaveLength(2);
    });

    it('rejects shared connector with allowedInstanceIds', () => {
      const connector = createConnector({
        isShared: true,
        allowedInstanceIds: ['bot-1'],
      });
      expect(() => validateIntegrationConnector(connector)).toThrow();
    });

    it('requires allowedInstanceIds for non-shared connector', () => {
      const connector = createConnector({
        isShared: false,
        allowedInstanceIds: [],
      });
      expect(() => validateIntegrationConnector(connector)).toThrow();
    });
  });

  describe('config validation', () => {
    describe('OpenAI config', () => {
      it('accepts valid OpenAI config', () => {
        const connector = createConnector({
          type: 'openai',
          config: {
            type: 'openai',
            apiKey: {
              name: 'openai-key',
              provider: 'aws-secrets-manager',
              arn: 'arn:aws:secretsmanager:us-east-1:123:secret:openai',
            },
            defaultModel: 'gpt-4',
          },
        });
        const result = validateIntegrationConnector(connector);
        expect(result.config.defaultModel).toBe('gpt-4');
      });

      it('accepts optional organization ID', () => {
        const connector = createConnector({
          type: 'openai',
          config: {
            type: 'openai',
            apiKey: {
              name: 'openai-key',
              provider: 'aws-secrets-manager',
              arn: 'arn:aws:secretsmanager:us-east-1:123:secret:openai',
            },
            organizationId: {
              name: 'openai-org',
              provider: 'aws-secrets-manager',
              arn: 'arn:aws:secretsmanager:us-east-1:123:secret:org',
            },
            defaultModel: 'gpt-4',
          },
        });
        const result = validateIntegrationConnector(connector);
        expect(result.config.organizationId).toBeDefined();
      });
    });

    describe('Slack config', () => {
      it('accepts valid Slack config', () => {
        const connector = createConnector({
          type: 'slack',
          config: {
            type: 'slack',
            botToken: {
              name: 'slack-token',
              provider: 'aws-secrets-manager',
              arn: 'arn:aws:secretsmanager:us-east-1:123:secret:slack',
            },
            signingSecret: {
              name: 'slack-signing',
              provider: 'aws-secrets-manager',
              arn: 'arn:aws:secretsmanager:us-east-1:123:secret:signing',
            },
            socketMode: true,
          },
        });
        const result = validateIntegrationConnector(connector);
        expect(result.config.socketMode).toBe(true);
      });

      it('accepts HTTP mode without signing secret', () => {
        const connector = createConnector({
          type: 'slack',
          config: {
            type: 'slack',
            botToken: {
              name: 'slack-token',
              provider: 'aws-secrets-manager',
              arn: 'arn:aws:secretsmanager:us-east-1:123:secret:slack',
            },
            socketMode: false,
            webhookUrl: 'https://api.example.com/slack/events',
          },
        });
        const result = validateIntegrationConnector(connector);
        expect(result.config.socketMode).toBe(false);
      });
    });

    describe('Database config', () => {
      it('accepts valid PostgreSQL config', () => {
        const connector = createConnector({
          type: 'postgres',
          config: {
            type: 'postgres',
            connectionString: {
              name: 'postgres-url',
              provider: 'aws-secrets-manager',
              arn: 'arn:aws:secretsmanager:us-east-1:123:secret:postgres',
            },
            ssl: true,
            maxConnections: 20,
          },
        });
        const result = validateIntegrationConnector(connector);
        expect(result.config.maxConnections).toBe(20);
      });

      it('accepts SSL mode options', () => {
        const sslModes = ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'];

        for (const sslMode of sslModes) {
          const connector = createConnector({
            type: 'postgres',
            config: {
              type: 'postgres',
              connectionString: {
                name: 'postgres-url',
                provider: 'aws-secrets-manager',
                arn: 'arn:aws:secretsmanager:us-east-1:123:secret:postgres',
              },
              sslMode,
            },
          });
          const result = validateIntegrationConnector(deepClone(connector));
          expect(result.config.sslMode).toBe(sslMode);
        }
      });
    });

    describe('Custom config', () => {
      it('accepts valid custom config', () => {
        const connector = createConnector({
          type: 'custom',
          config: {
            type: 'custom',
            credentials: {
              apiKey: {
                name: 'custom-key',
                provider: 'aws-secrets-manager',
                arn: 'arn:aws:secretsmanager:us-east-1:123:secret:custom',
              },
            },
            config: {
              baseUrl: 'https://api.custom.com',
              timeout: 30000,
              retries: 3,
            },
          },
        });
        const result = validateIntegrationConnector(connector);
        expect(result.config.config.baseUrl).toBe('https://api.custom.com');
      });

      it('accepts empty custom config', () => {
        const connector = createConnector({
          type: 'custom',
          config: {
            type: 'custom',
            credentials: {},
            config: {},
          },
        });
        const result = validateIntegrationConnector(connector);
        expect(result.config.config).toEqual({});
      });
    });
  });

  describe('usage tracking validation', () => {
    it('defaults usageCount to 0', () => {
      const connector = createConnector();
      delete (connector as any).usageCount;
      const result = IntegrationConnectorSchema.parse(connector);
      expect(result.usageCount).toBe(0);
    });

    it('accepts positive usage count', () => {
      const connector = createConnector({ usageCount: 1000 });
      const result = validateIntegrationConnector(connector);
      expect(result.usageCount).toBe(1000);
    });

    it('rejects negative usage count', () => {
      const connector = createConnector({ usageCount: -1 });
      expect(() => validateIntegrationConnector(connector)).toThrow();
    });

    it('accepts null lastUsedAt', () => {
      const connector = createConnector({ lastUsedAt: null });
      const result = validateIntegrationConnector(connector);
      expect(result.lastUsedAt).toBeNull();
    });

    it('accepts valid lastUsedAt', () => {
      const now = new Date();
      const connector = createConnector({ lastUsedAt: now });
      const result = validateIntegrationConnector(connector);
      expect(result.lastUsedAt).toEqual(now);
    });
  });

  describe('rotation schedule validation', () => {
    it('accepts undefined rotation schedule', () => {
      const connector = createConnector();
      const result = validateIntegrationConnector(connector);
      expect(result.rotationSchedule).toBeUndefined();
    });

    it('accepts valid rotation schedule', () => {
      const now = new Date();
      const connector = createConnector({
        rotationSchedule: {
          enabled: true,
          frequency: 'monthly',
          lastRotatedAt: now,
          nextRotationAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      const result = validateIntegrationConnector(connector);
      expect(result.rotationSchedule?.enabled).toBe(true);
    });

    it('accepts different rotation frequencies', () => {
      const frequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

      for (const frequency of frequencies) {
        const connector = createConnector({
          rotationSchedule: {
            enabled: true,
            frequency: frequency as any,
          },
        });
        const result = validateIntegrationConnector(deepClone(connector));
        expect(result.rotationSchedule?.frequency).toBe(frequency);
      }
    });

    it('rejects invalid rotation frequency', () => {
      const connector = createConnector({
        rotationSchedule: {
          enabled: true,
          frequency: 'hourly',
        },
      });
      expect(() => validateIntegrationConnector(connector)).toThrow();
    });
  });

  describe('last tested validation', () => {
    it('accepts null lastTestedAt', () => {
      const connector = createConnector({ lastTestedAt: null });
      const result = validateIntegrationConnector(connector);
      expect(result.lastTestedAt).toBeNull();
    });

    it('accepts valid last test result', () => {
      const now = new Date();
      const connector = createConnector({
        lastTestedAt: now,
        lastTestResult: 'SUCCESS',
      });
      const result = validateIntegrationConnector(connector);
      expect(result.lastTestResult).toBe('SUCCESS');
    });

    it('accepts FAILURE test result', () => {
      const connector = createConnector({
        lastTestedAt: new Date(),
        lastTestResult: 'FAILURE',
      });
      const result = validateIntegrationConnector(connector);
      expect(result.lastTestResult).toBe('FAILURE');
    });

    it('rejects invalid test result', () => {
      const connector = createConnector({
        lastTestedAt: new Date(),
        lastTestResult: 'PARTIAL',
      });
      expect(() => validateIntegrationConnector(connector)).toThrow();
    });
  });

  describe('tags validation', () => {
    it('accepts empty tags', () => {
      const connector = createConnector({ tags: {} });
      const result = validateIntegrationConnector(connector);
      expect(result.tags).toEqual({});
    });

    it('accepts valid tags', () => {
      const connector = createConnector({
        tags: {
          team: 'platform',
          environment: 'production',
          criticality: 'high',
        },
      });
      const result = validateIntegrationConnector(connector);
      expect(result.tags.team).toBe('platform');
    });

    it('rejects too many tags', () => {
      const tags: Record<string, string> = {};
      for (let i = 0; i < 60; i++) {
        tags[`tag-${i}`] = `value-${i}`;
      }
      const connector = createConnector({ tags });
      expect(() => validateIntegrationConnector(connector)).toThrow();
    });
  });
});

describe('ConnectorRef - Edge Cases', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it('validates minimal connector ref', () => {
    const ref = {
      connectorId: 'conn-123',
      workspaceId: 'workspace-123',
      type: 'openai',
    };
    const result = validateConnectorRef(ref);
    expect(result.connectorId).toBe('conn-123');
  });

  it('accepts config overrides', () => {
    const ref = {
      connectorId: 'conn-123',
      workspaceId: 'workspace-123',
      type: 'openai',
      configOverrides: {
        defaultModel: 'gpt-3.5-turbo',
        temperature: 0.7,
      },
    };
    const result = validateConnectorRef(ref);
    expect(result.configOverrides?.defaultModel).toBe('gpt-3.5-turbo');
  });

  it('accepts credential key selection', () => {
    const ref = {
      connectorId: 'conn-123',
      workspaceId: 'workspace-123',
      type: 'aws',
      credentialKeys: ['accessKeyId', 'secretAccessKey'],
    };
    const result = validateConnectorRef(ref);
    expect(result.credentialKeys).toEqual(['accessKeyId', 'secretAccessKey']);
  });

  it('rejects empty connectorId', () => {
    const ref = {
      connectorId: '',
      workspaceId: 'workspace-123',
      type: 'openai',
    };
    expect(() => validateConnectorRef(ref)).toThrow();
  });

  it('rejects empty workspaceId', () => {
    const ref = {
      connectorId: 'conn-123',
      workspaceId: '',
      type: 'openai',
    };
    expect(() => validateConnectorRef(ref)).toThrow();
  });
});

describe('BotConnectorBinding - Edge Cases', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it('validates minimal binding', () => {
    const binding = {
      id: 'binding-123',
      botInstanceId: 'bot-123',
      connectorId: 'conn-123',
      purpose: 'llm',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = validateBotConnectorBinding(binding);
    expect(result.purpose).toBe('llm');
  });

  it('accepts all valid purposes', () => {
    const purposes = ['llm', 'channel', 'database', 'storage', 'external_api', 'other'];

    for (const purpose of purposes) {
      const binding = {
        id: 'binding-123',
        botInstanceId: 'bot-123',
        connectorId: 'conn-123',
        purpose,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = BotConnectorBindingSchema.parse(deepClone(binding));
      expect(result.purpose).toBe(purpose);
    }
  });

  it('accepts channel config for channel purpose', () => {
    const binding = {
      id: 'binding-123',
      botInstanceId: 'bot-123',
      connectorId: 'conn-slack',
      purpose: 'channel',
      channelConfig: {
        channelType: 'slack',
        enabled: true,
        settings: {
          channels: ['#general', '#support'],
          notifyOnError: true,
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = validateBotConnectorBinding(binding);
    expect(result.channelConfig?.channelType).toBe('slack');
  });

  it('accepts overrides', () => {
    const binding = {
      id: 'binding-123',
      botInstanceId: 'bot-123',
      connectorId: 'conn-123',
      purpose: 'llm',
      overrides: {
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 2000,
        topP: 0.9,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = validateBotConnectorBinding(binding);
    expect(result.overrides?.temperature).toBe(0.5);
  });

  it('accepts health status', () => {
    const binding = {
      id: 'binding-123',
      botInstanceId: 'bot-123',
      connectorId: 'conn-123',
      purpose: 'llm',
      healthStatus: 'HEALTHY',
      lastHealthCheck: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = validateBotConnectorBinding(binding);
    expect(result.healthStatus).toBe('HEALTHY');
  });

  it('accepts all health statuses', () => {
    const statuses = ['HEALTHY', 'UNHEALTHY', 'UNKNOWN', 'DEGRADED'];

    for (const status of statuses) {
      const binding = {
        id: 'binding-123',
        botInstanceId: 'bot-123',
        connectorId: 'conn-123',
        purpose: 'llm',
        healthStatus: status,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = BotConnectorBindingSchema.parse(deepClone(binding));
      expect(result.healthStatus).toBe(status);
    }
  });
});

describe('ConnectionTestResult - Edge Cases', () => {
  it('validates successful test', () => {
    const result = {
      connectorId: 'conn-123',
      testedAt: new Date(),
      success: true,
      responseTimeMs: 150,
      checks: [
        { name: 'Authentication', passed: true },
        { name: 'API Access', passed: true },
      ],
    };
    const validated = ConnectionTestResultSchema.parse(result);
    expect(validated.success).toBe(true);
  });

  it('validates failed test with all details', () => {
    const result = {
      connectorId: 'conn-123',
      testedAt: new Date(),
      success: false,
      responseTimeMs: 5000,
      statusCode: 401,
      errorMessage: 'Invalid API key',
      errorCode: 'AUTH_FAILED',
      checks: [
        { name: 'Authentication', passed: false, message: 'Invalid credentials' },
        { name: 'API Access', passed: false, message: 'Skipped due to auth failure' },
      ],
    };
    const validated = ConnectionTestResultSchema.parse(result);
    expect(validated.success).toBe(false);
    expect(validated.errorCode).toBe('AUTH_FAILED');
  });

  it('accepts zero response time', () => {
    const result = {
      connectorId: 'conn-123',
      testedAt: new Date(),
      success: true,
      responseTimeMs: 0,
      checks: [],
    };
    const validated = ConnectionTestResultSchema.parse(result);
    expect(validated.responseTimeMs).toBe(0);
  });

  it('rejects negative response time', () => {
    const result = {
      connectorId: 'conn-123',
      testedAt: new Date(),
      success: true,
      responseTimeMs: -1,
      checks: [],
    };
    expect(() => ConnectionTestResultSchema.parse(result)).toThrow();
  });

  it('accepts check with detailed message', () => {
    const result = {
      connectorId: 'conn-123',
      testedAt: new Date(),
      success: false,
      responseTimeMs: 100,
      checks: [
        {
          name: 'Rate Limit',
          passed: false,
          message: 'Rate limit exceeded: 100 requests per minute',
          details: {
            limit: 100,
            remaining: 0,
            resetTime: new Date().toISOString(),
          },
        },
      ],
    };
    const validated = ConnectionTestResultSchema.parse(result);
    expect(validated.checks[0].details?.limit).toBe(100);
  });
});
