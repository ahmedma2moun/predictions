import { ScoringRuleRepository } from '@/lib/repositories/scoring-rule-repository';
import { Prisma } from '@prisma/client';

export class ScoringRuleService {
  static getAll(args?: Prisma.ScoringRuleFindManyArgs) {
    return ScoringRuleRepository.findMany(args);
  }
  static getById(args: Prisma.ScoringRuleFindUniqueArgs) {
    return ScoringRuleRepository.findUnique(args);
  }
  static create(args: Prisma.ScoringRuleCreateArgs) {
    return ScoringRuleRepository.create(args);
  }
  static update(args: Prisma.ScoringRuleUpdateArgs) {
    return ScoringRuleRepository.update(args);
  }
  static remove(args: Prisma.ScoringRuleDeleteArgs) {
    return ScoringRuleRepository.delete(args);
  }
}
