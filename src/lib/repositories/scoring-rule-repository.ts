import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class ScoringRuleRepository {
  static findMany<T extends Prisma.ScoringRuleFindManyArgs>(args?: Prisma.SelectSubset<T, Prisma.ScoringRuleFindManyArgs>) {
    return prisma.scoringRule.findMany(args);
  }
  static findUnique<T extends Prisma.ScoringRuleFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.ScoringRuleFindUniqueArgs>) {
    return prisma.scoringRule.findUnique(args);
  }
  static create<T extends Prisma.ScoringRuleCreateArgs>(args: Prisma.SelectSubset<T, Prisma.ScoringRuleCreateArgs>) {
    return prisma.scoringRule.create(args);
  }
  static update<T extends Prisma.ScoringRuleUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.ScoringRuleUpdateArgs>) {
    return prisma.scoringRule.update(args);
  }
  static delete<T extends Prisma.ScoringRuleDeleteArgs>(args: Prisma.SelectSubset<T, Prisma.ScoringRuleDeleteArgs>) {
    return prisma.scoringRule.delete(args);
  }
}
