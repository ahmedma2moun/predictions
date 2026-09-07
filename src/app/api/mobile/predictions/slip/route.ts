import { gameRoute } from '@/lib/game/routes';

export const GET = gameRoute(true, 'slip');
export const POST = gameRoute(true, 'slip', true);
