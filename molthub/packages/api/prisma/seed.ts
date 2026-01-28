import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create a sample fleet
  const fleet = await prisma.fleet.upsert({
    where: { id: 'sample-fleet-001' },
    update: {},
    create: {
      id: 'sample-fleet-001',
      name: 'Sample Fleet',
      description: 'A sample fleet for testing',
      status: 'ACTIVE',
    },
  })
  console.log('✅ Created fleet:', fleet.name)

  // Create a sample bot template
  const template = await prisma.botTemplate.upsert({
    where: { id: 'sample-template-001' },
    update: {},
    create: {
      id: 'sample-template-001',
      name: 'Echo Bot',
      description: 'A simple bot that echoes messages',
      version: '1.0.0',
      config: {
        type: 'echo',
        settings: {
          prefix: 'Echo: ',
        },
      },
    },
  })
  console.log('✅ Created template:', template.name)

  // Create a sample bot
  const bot = await prisma.bot.upsert({
    where: { id: 'sample-bot-001' },
    update: {},
    create: {
      id: 'sample-bot-001',
      name: 'Sample Bot',
      description: 'A sample bot instance',
      fleetId: fleet.id,
      templateId: template.id,
      status: 'IDLE',
      config: {
        greeting: 'Hello from Sample Bot!',
      },
    },
  })
  console.log('✅ Created bot:', bot.name)

  console.log('✅ Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
