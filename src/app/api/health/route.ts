import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/src/server/env/config';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  const env = getEnv();
  const schemeSource = env.SCHEME_SOURCE;
  const schemeId = env.ACTIVE_SCHEME_ID;
  
  let schemeLoaded = false;
  let schemeData: any = null;

  // Try to load the scheme based on SCHEME_SOURCE
  if (schemeSource === 'file') {
    try {
      const filePath = path.join(process.cwd(), 'data', 'example-scheme.json');
      const content = await fs.readFile(filePath, 'utf-8');
      schemeData = JSON.parse(content);
      schemeLoaded = true;
    } catch (err) {
      schemeLoaded = false;
    }
  }

  return NextResponse.json({
    status: 'ok',
    schemeSource,
    schemeId,
    schemeLoaded,
    timestamp: new Date().toISOString(),
  });
}
