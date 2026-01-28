// Test setup file
import 'reflect-metadata';

// Set test environment variables
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!!!';
process.env.JWT_SECRET = 'test-jwt-secret-32-characters-long!';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/molthub_test';
