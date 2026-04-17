const fs = require('fs');
const path = require('path');

const models = ['League', 'Team', 'ScoringRule', 'Device'];
const baseDir = 'd:\\Antigravity\\Matches Prediction\\football-predictions';

for (const model of models) {
  const lower = model.charAt(0).toLowerCase() + model.slice(1);
  const kebab = model.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  
  // Create Repository
  const repoContent = `import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class ${model}Repository {
  static findMany<T extends Prisma.${model}FindManyArgs>(args?: Prisma.SelectSubset<T, Prisma.${model}FindManyArgs>) {
    return prisma.${lower}.findMany(args);
  }
  static findUnique<T extends Prisma.${model}FindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.${model}FindUniqueArgs>) {
    return prisma.${lower}.findUnique(args);
  }
  static create<T extends Prisma.${model}CreateArgs>(args: Prisma.SelectSubset<T, Prisma.${model}CreateArgs>) {
    return prisma.${lower}.create(args);
  }
  static update<T extends Prisma.${model}UpdateArgs>(args: Prisma.SelectSubset<T, Prisma.${model}UpdateArgs>) {
    return prisma.${lower}.update(args);
  }
  static delete<T extends Prisma.${model}DeleteArgs>(args: Prisma.SelectSubset<T, Prisma.${model}DeleteArgs>) {
    return prisma.${lower}.delete(args);
  }
}
`;
  fs.writeFileSync(path.join(baseDir, 'src/lib/repositories', `${kebab}-repository.ts`), repoContent);
  
  // Create Service
  const serviceContent = `import { ${model}Repository } from '@/lib/repositories/${kebab}-repository';
import { Prisma } from '@prisma/client';

export class ${model}Service {
  static getAll(args?: Prisma.${model}FindManyArgs) {
    return ${model}Repository.findMany(args);
  }
  static getById(args: Prisma.${model}FindUniqueArgs) {
    return ${model}Repository.findUnique(args);
  }
  static create(args: Prisma.${model}CreateArgs) {
    return ${model}Repository.create(args);
  }
  static update(args: Prisma.${model}UpdateArgs) {
    return ${model}Repository.update(args);
  }
  static remove(args: Prisma.${model}DeleteArgs) {
    return ${model}Repository.delete(args);
  }
}
`;
  fs.writeFileSync(path.join(baseDir, 'src/lib/services', `${kebab}-service.ts`), serviceContent);
}

// Replace in routes
function replaceInFile(filePath, model) {
  const p = path.join(baseDir, filePath);
  if (!fs.existsSync(p)) return;
  
  let content = fs.readFileSync(p, 'utf-8');
  const lower = model.charAt(0).toLowerCase() + model.slice(1);
  const kebab = model.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  
  const searchRegex = new RegExp(`prisma\\.${lower}\\.`, 'g');
  if (content.match(searchRegex)) {
    content = content.replace(searchRegex, `${model}Service.`);
    // Map the method names if needed, but the service has getAll, getById etc.
    // Actually, it's easier if the service mirrors the Prisma methods so we don't have to rewrite the route handler logic manually.
    // So let's make the service mirror Prisma methods:
    content = content.replace(new RegExp(`${model}Service\\.findMany`, 'g'), `${model}Service.getAll`);
    content = content.replace(new RegExp(`${model}Service\\.findUnique`, 'g'), `${model}Service.getById`);
    content = content.replace(new RegExp(`${model}Service\\.delete`, 'g'), `${model}Service.remove`);

    if (!content.includes(`${model}Service`)) return;

    if (!content.includes(`@/lib/services/${kebab}-service`)) {
      const importStmt = `import { ${model}Service } from '@/lib/services/${kebab}-service';\n`;
      content = importStmt + content;
    }
    
    fs.writeFileSync(p, content);
    console.log('Updated ' + filePath);
  }
}

const targetFiles = [
  'src/app/api/admin/leagues/route.ts',
  'src/app/api/admin/teams/route.ts',
  'src/app/api/admin/scoring-rules/route.ts',
  'src/app/api/mobile/devices/route.ts',
  'src/app/api/admin/notifications/devices/route.ts',
  'src/app/api/admin/recalculate/route.ts',
  'src/lib/matches-processor.ts',
  'src/lib/results-processor.ts',
  'src/lib/services/league-service.ts'
];

for (const f of targetFiles) {
  replaceInFile(f, 'League');
  replaceInFile(f, 'Team');
  replaceInFile(f, 'ScoringRule');
  replaceInFile(f, 'Device');
}
