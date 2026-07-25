import { HealthStatus } from '@auvora/types';
import { NextResponse } from 'next/server';

export function GET(): NextResponse {
  return NextResponse.json({
    status: HealthStatus.Ok,
    service: 'docs',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
}
