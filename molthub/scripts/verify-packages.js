#!/usr/bin/env node
/**
 * Verify Package Configuration Script
 * Ensures all packages have proper metadata for publishing
 */

const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');

const REQUIRED_FIELDS = [
  'name',
  'version',
  'description',
  'main',
  'types'
];

const OPTIONAL_BUT_RECOMMENDED = [
  'repository',
  'keywords',
  'author',
  'license'
];

function getPackages() {
  const packages = [];
  const dirs = fs.readdirSync(PACKAGES_DIR);
  
  for (const dir of dirs) {
    const packagePath = path.join(PACKAGES_DIR, dir, 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      packages.push({ name: dir, pkg, path: packagePath });
    }
  }
  
  return packages;
}

function validatePackage(pkgInfo) {
  const { name, pkg, path: pkgPath } = pkgInfo;
  const issues = [];
  
  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!pkg[field]) {
      issues.push(`Missing required field: ${field}`);
    }
  }
  
  // Check versioning format
  if (pkg.version && !/^\d+\.\d+\.\d+/.test(pkg.version)) {
    issues.push(`Invalid version format: ${pkg.version}`);
  }
  
  // Check scoped name
  if (pkg.name && !pkg.name.startsWith('@molthub/')) {
    issues.push(`Package name should be scoped with @molthub/: ${pkg.name}`);
  }
  
  // Check engines
  if (!pkg.engines || !pkg.engines.node) {
    issues.push('Missing engines.node specification');
  }
  
  // Check publishConfig for public packages
  if (!pkg.private && (!pkg.publishConfig || pkg.publishConfig.access !== 'public')) {
    issues.push('Missing publishConfig.access: "public" for public package');
  }
  
  return issues;
}

function main() {
  console.log('🔍 Verifying package configurations...\n');
  
  const packages = getPackages();
  let hasErrors = false;
  
  for (const pkgInfo of packages) {
    const issues = validatePackage(pkgInfo);
    
    if (issues.length === 0) {
      console.log(`✅ ${pkgInfo.pkg.name || pkgInfo.name}`);
    } else {
      console.log(`❌ ${pkgInfo.pkg.name || pkgInfo.name}:`);
      for (const issue of issues) {
        console.log(`   - ${issue}`);
      }
      hasErrors = true;
    }
  }
  
  console.log('');
  
  if (hasErrors) {
    console.log('❌ Package validation failed');
    process.exit(1);
  } else {
    console.log('✅ All packages are valid');
  }
}

main();
