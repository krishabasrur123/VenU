/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { clientIpOf, json, serverKey } from '../edge';

describe('shared edge helpers', () => {
  it('serverKey: the default secret key, else the legacy service_role key', () => {
    const env = (vars: Record<string, string>) => (name: string) => vars[name];
    expect(serverKey(env({ SUPABASE_SECRET_KEYS: '{"default":"sb_secret_x"}', SUPABASE_SERVICE_ROLE_KEY: 'legacy' }))).toBe('sb_secret_x');
    expect(serverKey(env({ SUPABASE_SECRET_KEYS: 'not json', SUPABASE_SERVICE_ROLE_KEY: 'legacy' }))).toBe('legacy');
    expect(serverKey(env({ SUPABASE_SECRET_KEYS: '{}', SUPABASE_SERVICE_ROLE_KEY: 'legacy' }))).toBe('legacy');
    expect(serverKey(env({}))).toBe('');
  });

  it('json: the body with CORS headers', async () => {
    const res = json(400, { code: 'bad_request' });
    expect(res.status).toBe(400);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ code: 'bad_request' });
  });

  it('clientIpOf: Cf-Connecting-Ip only', () => {
    expect(clientIpOf(new Request('http://x', { headers: { 'cf-connecting-ip': ' 203.0.113.7 ' } }))).toEqual({ ip: '203.0.113.7', source: 'cf-connecting-ip' });
    expect(clientIpOf(new Request('http://x', { headers: { 'x-forwarded-for': '198.51.100.1' } }))).toEqual({ ip: null, source: 'none' });
  });
});
