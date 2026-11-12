// Ties the volunteer request to the signed-in user. Mounted once inside ProfileProvider (root
// layout), so it sees every sign-out and user switch, whichever screen is showing.
import { useEffect } from 'react';

import { useProfile } from '@/features/profile/profile-context';

import { volunteerRequests } from './request-store';

export function VolunteerSessionReset() {
  const { status, userId } = useProfile();
  useEffect(() => {
    // 'loading' and 'error' keep the session (and the request) as it was.
    if (status === 'signedOut') void volunteerRequests.setUser(null);
    else if (status === 'ready') void volunteerRequests.setUser(userId);
  }, [status, userId]);
  return null;
}
