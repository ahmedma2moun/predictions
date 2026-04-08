import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('Connected to PostgreSQL via Prisma');

  // Create admin user
  const existing = await prisma.user.findUnique({ where: { email: 'admin@predictions.app' } });
  if (!existing) {
    const hashed = await bcrypt.hash('changeme123', 12);
    await prisma.user.create({
      data: { name: 'Admin', email: 'admin@predictions.app', password: hashed, role: 'admin' },
    });
    console.log('Admin user created');
  } else {
    console.log('Admin user already exists');
  }

  // Seed default "General" group and add all existing users
  const existingDefault = await prisma.group.findFirst({ where: { isDefault: true } });
  if (!existingDefault) {
    const generalGroup = await prisma.group.create({
      data: { name: 'General', isDefault: true },
    });
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    if (allUsers.length > 0) {
      await prisma.groupMember.createMany({
        data: allUsers.map(u => ({ groupId: generalGroup.id, userId: u.id })),
        skipDuplicates: true,
      });
    }
    console.log(`General group created and ${allUsers.length} user(s) added`);
  } else {
    // Ensure all existing users are in the General group (idempotent backfill)
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    await prisma.groupMember.createMany({
      data: allUsers.map(u => ({ groupId: existingDefault.id, userId: u.id })),
      skipDuplicates: true,
    });
    console.log('General group already exists — backfilled any missing members');
  }

  // Seed scoring rules
  const rules = [
    { name: 'Correct Winner/Draw', description: 'Predicted winner matches actual winner (home/away/draw)', key: 'correct_winner', points: 2, priority: 1, isActive: true },
    { name: 'Exact Score', description: 'Both predicted scores match exactly', key: 'exact_score', points: 5, priority: 2, isActive: true },
    { name: 'Correct Score Difference', description: 'Goal difference matches (e.g., predicted 3-1, actual 2-0)', key: 'score_difference', points: 3, priority: 3, isActive: true },
    { name: 'One Team Correct Score', description: 'Either the predicted home score or away score matches the actual', key: 'one_team_score', points: 1, priority: 4, isActive: true },
  ];

  for (const rule of rules) {
    await prisma.scoringRule.upsert({
      where: { key: rule.key },
      create: rule,
      update: {},
    });
  }
  console.log('Scoring rules seeded');

  await prisma.$disconnect();
  console.log('Done');
}

seed().catch((e) => { console.error(e); process.exit(1); });
