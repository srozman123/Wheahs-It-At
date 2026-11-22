import { request } from './client';
import type { FriendsGoingEvent, PublicUser, RequestStatus } from './types';

const friendPath = (userId: string) => encodeURIComponent(userId);

export async function getFriends(): Promise<PublicUser[]> {
  const { friends } = await request<{ friends: PublicUser[] }>('GET', '/friends');
  return friends;
}

export function getFriendRequests(): Promise<{ incoming: PublicUser[]; outgoing: PublicUser[] }> {
  return request('GET', '/friends/requests');
}

/** Returns 'accepted' if they had already asked you. */
export async function sendFriendRequest(userId: string): Promise<RequestStatus> {
  const { status } = await request<{ status: RequestStatus }>('POST', '/friends/requests', {
    body: { userId },
  });
  return status;
}

export async function acceptFriendRequest(userId: string): Promise<PublicUser> {
  const { friend } = await request<{ friend: PublicUser }>(
    'POST',
    `/friends/requests/${friendPath(userId)}/accept`,
  );
  return friend;
}

export async function declineFriendRequest(userId: string): Promise<void> {
  await request<{ ok: true }>('POST', `/friends/requests/${friendPath(userId)}/decline`);
}

export async function removeFriend(userId: string): Promise<void> {
  await request<{ ok: true }>('DELETE', `/friends/${friendPath(userId)}`);
}

export async function getFriendsEvents(): Promise<FriendsGoingEvent[]> {
  const { events } = await request<{ events: FriendsGoingEvent[] }>('GET', '/friends/events');
  return events;
}
