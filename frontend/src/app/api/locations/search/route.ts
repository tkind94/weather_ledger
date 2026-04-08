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
		const message = error instanceof Error ? error.message : 'Unable to search locations.';
		return Response.json({ message }, { status: 500 });
	}
}
