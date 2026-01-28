// Jest setup file - set environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/molthub_test';
process.env.AWS_REGION = 'us-east-1';
process.env.ECS_CLUSTER_ARN = 'arn:aws:ecs:us-east-1:123456789:cluster/test';
