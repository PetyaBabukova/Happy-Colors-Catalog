import { NextResponse } from 'next/server';
import { requireApiAuth, requireApiFullAdmin } from '../../_lib/auth';
import { getGoogleAnalyticsSummary } from '../../_lib/googleAnalytics';

export const runtime = 'nodejs';

const ANALYTICS_LOAD_ERROR_MESSAGE = 'Неуспешно зареждане на аналитичните данни.';

export async function GET(request) {
  try {
    const auth = requireApiFullAdmin(await requireApiAuth(request));

    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === '1';
    const summary = await getGoogleAnalyticsSummary({ forceRefresh });

    return NextResponse.json(summary, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=0, no-store',
      },
    });
  } catch (error) {
    console.error('Error in /api/analytics/summary:', error);

    const isGoogleAnalyticsError = error?.name === 'GoogleAnalyticsError';

    return NextResponse.json(
      {
        message: isGoogleAnalyticsError ? error.message : ANALYTICS_LOAD_ERROR_MESSAGE,
        code: isGoogleAnalyticsError ? error.code : 'analytics_summary_failed',
      },
      { status: isGoogleAnalyticsError ? error.status || 500 : 500 }
    );
  }
}
