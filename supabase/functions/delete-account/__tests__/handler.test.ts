/**
 * @jest-environment node
 */
import { describe, expect, it, jest } from '@jest/globals';

import { createHandler } from '../handler.ts';

const ROSA = '11111111-1111-1111-1111-111111111111';

function setup() {
  const order: string[] = [];
  const verifyUser = jest.fn(async (token: string) => (token === 'rosa-token' ? ROSA : null));
  const listAvatars = jest.fn(async (userId: string) => {
    order.push('list');
    return [`${userId}/avatar-1`, `${userId}/avatar-2`];
  });
  const removeAvatars = jest.fn(async (_paths: string[]) => {
    order.push('remove');
  });
  const deleteUser = jest.fn(async (_userId: string): Promise<'deleted' | 'gone'> => {
    order.push('deleteUser');
    return 'deleted';
  });
  const log = jest.fn();
  return { handle: createHandler({ verifyUser, listAvatars, removeAvatars, deleteUser, log }), verifyUser, listAvatars, removeAvatars, deleteUser, log, order };
}

const call = (handle: (r: Request) => Promise<Response>, token: string | null, method = 'POST') =>
  handle(new Request('http://x/functions/v1/delete-account', {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: method === 'POST' ? '{}' : undefined,
  }));

describe('delete-account function', () => {
  it("deletes the caller's photos, then the caller's auth user", async () => {
    const { handle, listAvatars, removeAvatars, deleteUser, order } = setup();
    const res = await call(handle, 'rosa-token');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(listAvatars).toHaveBeenCalledWith(ROSA);
    expect(removeAvatars).toHaveBeenCalledWith([`${ROSA}/avatar-1`, `${ROSA}/avatar-2`]);
    expect(deleteUser).toHaveBeenCalledWith(ROSA);
    // Storage refuses to delete a user who still owns files, so photos go first.
    expect(order).toEqual(['list', 'remove', 'deleteUser']);
  });

  it('only ever removes files in the caller’s own folder', async () => {
    const { handle, listAvatars, removeAvatars } = setup();
    listAvatars.mockResolvedValueOnce([`${ROSA}/avatar-1`, 'someone-else/avatar-1', `${ROSA}x/avatar`]);
    await call(handle, 'rosa-token');
    expect(removeAvatars).toHaveBeenCalledWith([`${ROSA}/avatar-1`]);
  });

  it('skips the storage call when there are no photos', async () => {
    const { handle, listAvatars, removeAvatars, deleteUser } = setup();
    listAvatars.mockResolvedValueOnce([]);
    expect((await call(handle, 'rosa-token')).status).toBe(200);
    expect(removeAvatars).not.toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalled();
  });

  it('treats an already deleted user as done (a retry after a lost reply)', async () => {
    const { handle, deleteUser } = setup();
    deleteUser.mockResolvedValueOnce('gone');
    expect((await call(handle, 'rosa-token')).status).toBe(200);
  });

  it.each([['no token', null], ['a bad token', 'forged'], ['the anon key', 'anon-key']])('refuses %s with 401 and deletes nothing', async (_, token) => {
    const { handle, listAvatars, deleteUser } = setup();
    const res = await call(handle, token);
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('not_signed_in');
    expect(listAvatars).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('answers 401 when verifying the token throws', async () => {
    const { handle, verifyUser, deleteUser } = setup();
    verifyUser.mockRejectedValueOnce(new Error('jwks down'));
    expect((await call(handle, 'rosa-token')).status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('keeps the user when removing photos fails, so a retry can finish', async () => {
    const { handle, removeAvatars, deleteUser, log } = setup();
    removeAvatars.mockRejectedValueOnce(new Error('storage down'));
    const res = await call(handle, 'rosa-token');
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe('unexpected_failure');
    expect(deleteUser).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join('\n')).toContain('storage down');
  });

  it('answers 502 and logs why when the database refuses the delete', async () => {
    const { handle, deleteUser, log } = setup();
    deleteUser.mockRejectedValueOnce(new Error('500 unexpected_failure Database error deleting user'));
    expect((await call(handle, 'rosa-token')).status).toBe(502);
    expect(log.mock.calls.flat().join('\n')).toContain('Database error deleting user');
  });

  it('answers CORS preflight and refuses other methods', async () => {
    const { handle } = setup();
    const pre = await call(handle, null, 'OPTIONS');
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect((await call(handle, 'rosa-token', 'GET')).status).toBe(405);
  });
});
