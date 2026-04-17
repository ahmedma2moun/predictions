import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class PredictionRepository {
  static findMany<T extends Prisma.PredictionFindManyArgs>(args: Prisma.SelectSubset<T, Prisma.PredictionFindManyArgs>) {
    return prisma.prediction.findMany(args);
  }

  static findFirst<T extends Prisma.PredictionFindFirstArgs>(args: Prisma.SelectSubset<T, Prisma.PredictionFindFirstArgs>) {
    return prisma.prediction.findFirst(args);
  }

  static upsert<T extends Prisma.PredictionUpsertArgs>(args: Prisma.SelectSubset<T, Prisma.PredictionUpsertArgs>) {
    return prisma.prediction.upsert(args);
  }

  static update<T extends Prisma.PredictionUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.PredictionUpdateArgs>) {
    return prisma.prediction.update(args);
  }

  static groupBy<T extends Prisma.PredictionGroupByArgs>(args: Prisma.SelectSubset<T, Prisma.PredictionGroupByArgs>) {
    return prisma.prediction.groupBy(args as any);
  }

  static count<T extends Prisma.PredictionCountArgs>(args?: Prisma.SelectSubset<T, Prisma.PredictionCountArgs>) {
    return prisma.prediction.count(args);
  }

  static getLeaderboardStats(whereClause: Prisma.Sql) {
    return prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          p."userId",
          SUM(p."pointsAwarded")                                  AS "totalPoints",
          COUNT(*)                                                 AS "predictionsCount",
          SUM(CASE WHEN p."pointsAwarded" > 0 THEN 1 ELSE 0 END) AS "correctPredictions"
        FROM "Prediction" p
        JOIN "Match" m ON m.id = p."matchId"
        WHERE ${whereClause}
        GROUP BY p."userId"
        ORDER BY "totalPoints" DESC
        LIMIT 100
      `,
    );
  }

  static transaction(promises: any[]) {
    return prisma.$transaction(promises);
  }
}
