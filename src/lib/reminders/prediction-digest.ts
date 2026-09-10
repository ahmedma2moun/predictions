import { Prisma } from '@prisma/client';

/** Digests nudge missing predictions; followed-team fixtures never qualify. */
export function predictionDigestWhere(from: Date, to: Date): Prisma.MatchWhereInput {
  return { predictionsEnabled: true, status: 'scheduled', kickoffTime: { gte: from, lte: to } };
}
