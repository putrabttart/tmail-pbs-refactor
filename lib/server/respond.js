import { NextResponse } from 'next/server';
import { HttpError } from './runtime';

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

export { respond, handleError };
