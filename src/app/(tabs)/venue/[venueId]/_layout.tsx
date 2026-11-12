import { Redirect, useLocalSearchParams } from 'expo-router';

import { getVenue } from '@/features/venue/mock';
import { VenueMapScreen } from '@/features/venue/venue-map-screen';

/** Map + bottom sheet; the child routes below render inside the sheet. */
export default function VenueLayout() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const venue = getVenue(venueId);
  if (!venue) return <Redirect href="/venue" />;
  return <VenueMapScreen venue={venue} />;
}
