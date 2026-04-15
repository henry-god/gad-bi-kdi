/**
 * GET /api/auth/users — list users (empty when no DB).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { prisma } = await import('../../../../backend/services/prisma');
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, nameKm: true, role: true },
      orderBy: { name: 'asc' },
    });
    return Response.json({ success: true, data: users });
  } catch {
    return Response.json({ success: true, data: [] });
  }
}
