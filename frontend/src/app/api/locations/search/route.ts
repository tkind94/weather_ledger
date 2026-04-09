import { searchLocations } from '@/lib/server/weather';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const query = url.searchParams.get('q')?.trim() ?? '';

	if (query === '') {
		return Response.json({ locations: [] });
	}

	try {
		const locations = await searchLocations(query);
		return Response.json({ locations });
	} catch (error) {
		console.error('Failed to search locations.', error);
		return Response.json({ error: 'Internal server error' }, { status: 500 });
	}
}
