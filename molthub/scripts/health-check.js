#!/usr/bin/env node
/**
 * Health Check Script
 * Checks the health of Molthub services
 */

const http = require('http');
const { execSync } = require('child_process');

const SERVICES = {
  api: {
    url: process.env.API_HEALTH_URL || 'http://localhost:3001/health',
    name: 'API Service'
  },
  web: {
    url: process.env.WEB_HEALTH_URL || 'http://localhost:3000/api/health',
    name: 'Web Service'
  }
};

const CHECK_DATABASE = process.env.CHECK_DATABASE !== 'false';
const CHECK_REDIS = process.env.CHECK_REDIS !== 'false';

async function checkHttpHealth(url, name) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      const healthy = res.statusCode === 200;
      console.log(`${name}: ${healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'} (HTTP ${res.statusCode})`);
      resolve(healthy);
    });

    req.on('error', (err) => {
      console.log(`${name}: ❌ UNHEALTHY (${err.message})`);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`${name}: ❌ UNHEALTHY (Timeout)`);
      resolve(false);
    });
  });
}

async function checkDockerServices() {
  try {
    const output = execSync('docker compose ps --format json', { encoding: 'utf8' });
    const services = JSON.parse(output);
    
    console.log('\n📦 Docker Services:');
    let allHealthy = true;
    
    for (const service of services) {
      const status = service.State === 'running' ? '✅' : '❌';
      console.log(`  ${status} ${service.Service}: ${service.State}`);
      if (service.State !== 'running') allHealthy = false;
    }
    
    return allHealthy;
  } catch (err) {
    console.log('\n📦 Docker Services: Unable to check (docker compose not available)');
    return true; // Don't fail if docker isn't available
  }
}

async function main() {
  console.log('🔍 Molthub Health Check\n');
  
  let allHealthy = true;

  // Check HTTP endpoints
  console.log('🌐 HTTP Endpoints:');
  for (const [key, service] of Object.entries(SERVICES)) {
    const healthy = await checkHttpHealth(service.url, service.name);
    if (!healthy) allHealthy = false;
  }

  // Check Docker services
  const dockerHealthy = await checkDockerServices();
  if (!dockerHealthy) allHealthy = false;

  console.log('\n' + (allHealthy ? '✅ All services are healthy' : '❌ Some services are unhealthy'));
  
  process.exit(allHealthy ? 0 : 1);
}

main().catch((err) => {
  console.error('Health check failed:', err);
  process.exit(1);
});
