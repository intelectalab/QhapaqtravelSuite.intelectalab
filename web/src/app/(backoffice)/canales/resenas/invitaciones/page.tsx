import type { Metadata } from "next";
import { PostTripInvitationsTable } from "@/features/channels/ReviewLinks";
import type { PostTripInvitations } from "@/lib/channels";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Invitaciones postviaje" };

export default async function PostTripInvitationsPage() {
  const data = await getResource<PostTripInvitations>("/channels/review-invitations", "No pudimos cargar las invitaciones postviaje.");
  if (!data) return null;
  return <PostTripInvitationsTable data={data} />;
}
