import { TeamRepository } from '@/lib/repositories/team-repository';
import { Prisma } from '@prisma/client';

export class TeamService {
  static getAll<T extends Prisma.TeamFindManyArgs>(args?: Prisma.SelectSubset<T, Prisma.TeamFindManyArgs>) {
    return TeamRepository.findMany(args);
  }
  static getById<T extends Prisma.TeamFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.TeamFindUniqueArgs>) {
    return TeamRepository.findUnique(args);
  }
  static create<T extends Prisma.TeamCreateArgs>(args: Prisma.SelectSubset<T, Prisma.TeamCreateArgs>) {
    return TeamRepository.create(args);
  }
  static update<T extends Prisma.TeamUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.TeamUpdateArgs>) {
    return TeamRepository.update(args);
  }
  static remove<T extends Prisma.TeamDeleteArgs>(args: Prisma.SelectSubset<T, Prisma.TeamDeleteArgs>) {
    return TeamRepository.delete(args);
  }
  static upsert<T extends Prisma.TeamUpsertArgs>(args: Prisma.SelectSubset<T, Prisma.TeamUpsertArgs>) {
    return TeamRepository.upsert(args);
  }
}
