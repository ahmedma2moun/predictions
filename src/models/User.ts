export interface IUser {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
