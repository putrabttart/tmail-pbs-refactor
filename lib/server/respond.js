import { NextResponse } from 'next/server';
import { HttpError, resolveTenantId } from './runtime';

function respond(data, init = {}) {
  return NextResponse.json(data, init);
}

function handleError(err) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

/**
 * Extract tenant ID from request for use in API route handlers.
 */
function getTenantFromRequest(request) {
  return resolveTenantId(request);
}

export { respond, handleError, getTenantFromRequest };
