import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '../src/common/encryption.service';

/**
 * Migration script to encrypt existing connector configs
 * 
 * Run this script with:
 * npx ts-node prisma/migrate-encrypt-configs.ts
 */
async function migrateEncryptConfigs() {
  const prisma = new PrismaClient();
  const encryptionService = new EncryptionService();

  console.log('Starting migration: Encrypting connector configs...');

  try {
    // Find all connectors that are not encrypted
    const connectors = await prisma.connector.findMany({
      where: {
        OR: [
          { isEncrypted: false },
          { isEncrypted: null },
        ],
      },
    });

    console.log(`Found ${connectors.length} connectors to encrypt`);

    for (const connector of connectors) {
      try {
        // Try to parse the config
        let config: Record<string, any>;
        
        try {
          config = JSON.parse(connector.config);
        } catch (e) {
          console.error(`Failed to parse config for connector ${connector.id}:`, e);
          continue;
        }

        // Check if already encrypted
        if (config.encrypted && config.iv && config.tag) {
          console.log(`Connector ${connector.id} already encrypted, updating flag...`);
          await prisma.connector.update({
            where: { id: connector.id },
            data: { isEncrypted: true },
          });
          continue;
        }

        // Encrypt the config
        const encryptedConfig = encryptionService.encryptJson(config);

        // Update the connector
        await prisma.connector.update({
          where: { id: connector.id },
          data: {
            config: encryptedConfig,
            isEncrypted: true,
          },
        });

        console.log(`Encrypted connector ${connector.id}`);
      } catch (error) {
        console.error(`Failed to encrypt connector ${connector.id}:`, error);
      }
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  migrateEncryptConfigs();
}

export { migrateEncryptConfigs };
