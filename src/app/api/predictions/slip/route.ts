import { gameRoute } from '@/lib/game/routes';

export const GET = gameRoute(false, 'slip');
export const POST = gameRoute(false, 'slip', true);
