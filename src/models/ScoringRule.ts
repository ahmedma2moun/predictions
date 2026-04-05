export interface IScoringRule {
  id: number;
  name: string;
  description: string;
  key: string;
  points: number;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
