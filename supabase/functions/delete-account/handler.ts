// Delete my account as a plain (Request) => Response function. index.ts serves it on Supabase
// (Deno); scripts/mock-supabase.mjs serves the same function in Node.
//
// The caller's own access token says who to delete; nobody can name another user. With the service
// role it removes the caller's photos (avatars/<uid>/…; Storage refuses to delete a user who still
// owns files), then the auth user. The database does the rest through its foreign keys
// (supabase/migrations/20261118030000_account_deletion.sql): profile and username go with the user,
// help requests stay for the other person with this user's id cleared, this user's messages go.
//   POST (Authorization: Bearer <access token>) → 200 { deleted: true }
//   no or bad token                            → 401 { code: 'not_signed_in' }
//   storage or auth failed                     → 502 { code: 'unexpected_failure' } (nothing half done
//     that a retry can't finish: photos first, so a failed user delete leaves only a photo-less account)

import { CORS, json } from '../_shared/edge.ts';

export interface HandlerDeps {
  /** The user id for a valid signed-in (not anonymous) user's access token, else null. */
  verifyUser(token: string): Promise<string | null>;
  /** Every stored object under `<userId>/` in the avatars bucket, as full paths. */
  listAvatars(userId: string): Promise<string[]>;
  removeAvatars(paths: string[]): Promise<void>;
  /** Deletes the auth user. Resolves 'gone' when there was no such user (already deleted). */
  deleteUser(userId: string): Promise<'deleted' | 'gone'>;
  log?: (line: string) => void;
}

const failed = () => json(502, { code: 'unexpected_failure', message: "Couldn't delete the account. Try again later." });
const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createHandler({ verifyUser, listAvatars, removeAvatars, deleteUser, log = console.error }: HandlerDeps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST') return json(405, { code: 'method_not_allowed', message: 'Use POST.' });

    const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
    let userId: string | null = null;
    try {
      userId = token ? await verifyUser(token) : null;
    } catch {
      userId = null;
    }
    if (!userId) return json(401, { code: 'not_signed_in', message: 'Sign in to delete your account.' });

    try {
      const paths = await listAvatars(userId);
      // Only ever this user's folder, whatever the listing returned.
      const own = paths.filter(p => p.startsWith(`${userId}/`));
      if (own.length) await removeAvatars(own);
    } catch (e) {
      log(`delete-account: removing photos failed: ${reason(e)}`);
      return failed();
    }

    try {
      await deleteUser(userId);
    } catch (e) {
      // e.g. a table added later references auth.users without ON DELETE: the database refuses.
      log(`delete-account: deleting the user failed: ${reason(e)}`);
      return failed();
    }
    return json(200, { deleted: true });
  };
}
