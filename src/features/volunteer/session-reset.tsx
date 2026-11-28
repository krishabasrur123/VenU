// Ties the volunteer request (and, for a volunteer, the request they accepted) to the signed-in user. Mounted once inside ProfileProvider (root
// layout), so it sees every sign-out and user switch, whichever screen is showing. Also tells the
// store the user's chat language, which sent messages are tagged with.
import { useEffect } from 'react';

import { useProfile } from '@/features/profile/profile-context';
import { profileChatLanguage } from '@/features/translate/languages';
import { setTranslationOwner } from '@/features/translate/service';
import { setWhereAmIOwner } from '@/features/venue/current';

import { volunteerDesk } from './desk-store';
import { volunteerRequests } from './request-store';

export function VolunteerSessionReset() {
  const { status, userId, profile } = useProfile();
  const language = profile ? profileChatLanguage(profile) : null;
  const isVolunteer = profile?.role === 'volunteer';
  useEffect(() => {
    // 'loading' and 'error' keep the session (and the request) as it was.
    // The venue and spot (and kept chat translations) belong to the account too, so the next person on this phone starts fresh.
    if (status === 'signedOut') {
      void volunteerRequests.setUser(null);
      void volunteerDesk.setUser(null);
      setWhereAmIOwner(null);
      setTranslationOwner(null);
    } else if (status === 'ready') {
      void volunteerRequests.setUser(userId);
      void volunteerDesk.setUser(userId, isVolunteer);
      setWhereAmIOwner(userId);
      setTranslationOwner(userId);
    }
  }, [status, userId, isVolunteer]);
  useEffect(() => {
    volunteerRequests.setLanguage(language);
    volunteerDesk.setLanguage(language);
  }, [language]);
  return null;
}
