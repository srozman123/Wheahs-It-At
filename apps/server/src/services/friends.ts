import { HTTPException } from "hono/http-exception";
import {
  acceptRequest,
  findRelationship,
  insertRequest,
  listAcceptedFriendIds,
  listAcceptedFriends,
  listIncomingRequesters,
  listOutgoingRequestees,
} from "../db/friends.js";
import { findUserSummaryById, userExists, type Contacts, type UserSummary } from "../db/users.js";

export type PublicUser = { id: string; name: string; isFriend: boolean; contacts?: Contacts };

// The only place that decides who sees contact info: friends only.
export function toPublicUser(user: UserSummary, isFriend: boolean): PublicUser {
  return isFriend
    ? { id: user.id, name: user.name, isFriend, contacts: user.contacts }
    : { id: user.id, name: user.name, isFriend };
}

export async function toPublicUsers(viewerId: string, users: UserSummary[]): Promise<PublicUser[]> {
  const friendIds = new Set(await listAcceptedFriendIds(viewerId));
  return users.map((user) => toPublicUser(user, friendIds.has(user.id)));
}

export type RequestStatus = "requested" | "accepted";

export async function sendRequest(me: string, them: string): Promise<RequestStatus> {
  if (me === them) {
    throw new HTTPException(400, { message: "You can't friend yourself" });
  }
  if (!(await userExists(them))) {
    throw new HTTPException(404, { message: "User not found" });
  }

  const { outgoing, incoming } = await findRelationship(me, them);
  if (outgoing === "accepted" || incoming === "accepted") {
    throw new HTTPException(409, { message: "Already friends" });
  }
  // The request may have vanished since findRelationship; then fall through and send our own.
  if (incoming === "requested" && (await acceptRequest(me, them))) {
    return "accepted";
  }
  if (outgoing !== "requested") {
    await insertRequest(me, them);
  }
  return "requested";
}

export async function acceptFriend(me: string, them: string): Promise<PublicUser> {
  if (!(await acceptRequest(me, them))) {
    throw new HTTPException(404, { message: "No pending request from this user" });
  }
  const user = await findUserSummaryById(them);
  return toPublicUser(user!, true);
}

// Requests are not friends yet, so contacts stay hidden.
export async function listFriends(me: string): Promise<PublicUser[]> {
  return (await listAcceptedFriends(me)).map((user) => toPublicUser(user, true));
}

export async function listRequests(me: string) {
  const [incoming, outgoing] = await Promise.all([listIncomingRequesters(me), listOutgoingRequestees(me)]);
  return {
    incoming: incoming.map((user) => toPublicUser(user, false)),
    outgoing: outgoing.map((user) => toPublicUser(user, false)),
  };
}
