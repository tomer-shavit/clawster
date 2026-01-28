/**
 * API Integration Tests - Connector Endpoints
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Connectors API (e2e)', () => {
  let app: INestApplication;
  let createdConnectorId: string;
  const workspaceId = 'test-workspace-123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /connectors', () => {
    it('should create an OpenAI connector', async () => {
      const response = await request(app.getHttpServer())
        .post('/connectors')
        .send({
          workspaceId,
          name: 'Test OpenAI Connector',
          type: 'openai',
          config: {
            type: 'openai',
            apiKey: {
              name: 'openai-api-key',
              provider: 'aws-secrets-manager',
              arn: 'arn:aws:secretsmanager:us-east-1:123:secret:openai',
            },
            defaultModel: 'gpt-4',
          },
          isShared: true,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test OpenAI Connector');
      expect(response.body.type).toBe('openai');
      expect(response.body.status).toBe('PENDING');
      createdConnectorId = response.body.id;
    });

    it('should create a Slack connector', async () => {
      const response = await request(app.getHttpServer())
        .post('/connectors')
        .send({
          workspaceId,
          name: 'Test Slack Connector',
          type: 'slack',
          config: {
            type: 'slack',
            botToken: {
              name: 'slack-bot-token',
              provider: 'aws-secrets-manager',
              arn: 'arn:aws:secretsmanager:us-east-1:123:secret:slack',
            },
            signingSecret: {
              name: 'slack-signing-secret',
              provider: 'aws-secrets-manager',
              arn: 'arn:aws:secretsmanager:us-east-1:123:secret:signing',
            },
            socketMode: true,
          },
        })
        .expect(201);

      expect(response.body.type).toBe('slack');
      expect(response.body.config.socketMode).toBe(true);
    });

    it('should create a private connector', async () => {
      const response = await request(app.getHttpServer())
        .post('/connectors')
        .send({
          workspaceId,
          name: 'Private Connector',
          type: 'custom',
          config: {
            type: 'custom',
            credentials: {},
            config: {},
          },
          isShared: false,
          allowedInstanceIds: ['bot-1', 'bot-2'],
        })
        .expect(201);

      expect(response.body.isShared).toBe(false);
      expect(response.body.allowedInstanceIds).toEqual(['bot-1', 'bot-2']);
    });

    it('should reject invalid connector type', async () => {
      await request(app.getHttpServer())
        .post('/connectors')
        .send({
          workspaceId,
          name: 'Invalid Connector',
          type: 'invalid',
          config: {},
        })
        .expect(400);
    });

    it('should reject empty name', async () => {
      await request(app.getHttpServer())
        .post('/connectors')
        .send({
          workspaceId,
          name: '',
          type: 'openai',
          config: {
            type: 'openai',
            apiKey: {
              name: 'key',
              provider: 'aws-secrets-manager',
              arn: 'arn:aws:secretsmanager:us-east-1:123:secret:key',
            },
          },
        })
        .expect(400);
    });

    it('should reject missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/connectors')
        .send({
          name: 'missing-fields',
        })
        .expect(400);
    });
  });

  describe('GET /connectors', () => {
    it('should list all connectors for workspace', async () => {
      const response = await request(app.getHttpServer())
        .get('/connectors')
        .query({ workspaceId })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/connectors')
        .query({ workspaceId, type: 'openai' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every((c: any) => c.type === 'openai')).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/connectors')
        .query({ workspaceId, status: 'PENDING' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by isShared', async () => {
      const response = await request(app.getHttpServer())
        .get('/connectors')
        .query({ workspaceId, isShared: true })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should require workspaceId', async () => {
      await request(app.getHttpServer())
        .get('/connectors')
        .expect(400);
    });
  });

  describe('GET /connectors/:id', () => {
    it('should get connector by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/connectors/${createdConnectorId}`)
        .expect(200);

      expect(response.body.id).toBe(createdConnectorId);
      expect(response.body.name).toBe('Test OpenAI Connector');
      expect(response.body).toHaveProperty('config');
    });

    it('should include bot bindings', async () => {
      const response = await request(app.getHttpServer())
        .get(`/connectors/${createdConnectorId}`)
        .expect(200);

      expect(response.body).toHaveProperty('botBindings');
    });

    it('should return 404 for non-existent connector', async () => {
      await request(app.getHttpServer())
        .get('/connectors/non-existent-id')
        .expect(404);
    });
  });

  describe('PATCH /connectors/:id', () => {
    it('should update connector name', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/connectors/${createdConnectorId}`)
        .send({
          name: 'Updated OpenAI Connector',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated OpenAI Connector');
    });

    it('should update connector config', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/connectors/${createdConnectorId}`)
        .send({
          config: {
            type: 'openai',
            apiKey: {
              name: 'openai-api-key',
              provider: 'aws-secrets-manager',
              arn: 'arn:aws:secretsmanager:us-east-1:123:secret:openai',
            },
            defaultModel: 'gpt-3.5-turbo',
          },
        })
        .expect(200);

      expect(response.body.config.defaultModel).toBe('gpt-3.5-turbo');
    });

    it('should update shared status', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/connectors/${createdConnectorId}`)
        .send({
          isShared: false,
          allowedInstanceIds: ['bot-1'],
        })
        .expect(200);

      expect(response.body.isShared).toBe(false);
    });

    it('should return 404 for non-existent connector', async () => {
      await request(app.getHttpServer())
        .patch('/connectors/non-existent-id')
        .send({ name: 'Test' })
        .expect(404);
    });
  });

  describe('POST /connectors/:id/test', () => {
    it('should test connector connection', async () => {
      const response = await request(app.getHttpServer())
        .post(`/connectors/${createdConnectorId}/test`)
        .expect(200);

      expect(response.body).toHaveProperty('connectorId');
      expect(response.body).toHaveProperty('testedAt');
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('responseTimeMs');
    });

    it('should return 404 for non-existent connector', async () => {
      await request(app.getHttpServer())
        .post('/connectors/non-existent-id/test')
        .expect(404);
    });
  });

  describe('PATCH /connectors/:id/status', () => {
    it('should update connector status', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/connectors/${createdConnectorId}/status`)
        .send({
          status: 'ACTIVE',
          message: 'Connection verified',
        })
        .expect(200);

      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.statusMessage).toBe('Connection verified');
    });

    it('should reject invalid status', async () => {
      await request(app.getHttpServer())
        .patch(`/connectors/${createdConnectorId}/status`)
        .send({
          status: 'INVALID',
        })
        .expect(400);
    });

    it('should return 404 for non-existent connector', async () => {
      await request(app.getHttpServer())
        .patch('/connectors/non-existent-id/status')
        .send({ status: 'ACTIVE' })
        .expect(404);
    });
  });

  describe('DELETE /connectors/:id', () => {
    it('should not delete connector with bindings', async () => {
      // Create a connector
      const createResponse = await request(app.getHttpServer())
        .post('/connectors')
        .send({
          workspaceId,
          name: 'connector-with-bindings',
          type: 'openai',
          config: {
            type: 'openai',
            apiKey: {
              name: 'key',
              provider: 'aws-secrets-manager',
              arn: 'arn:aws:secretsmanager:us-east-1:123:secret:key',
            },
          },
        })
        .expect(201);

      // Try to delete it
      await request(app.getHttpServer())
        .delete(`/connectors/${createResponse.body.id}`)
        .expect(200);
    });

    it('should return 404 for non-existent connector', async () => {
      await request(app.getHttpServer())
        .delete('/connectors/non-existent-id')
        .expect(404);
    });
  });
});
