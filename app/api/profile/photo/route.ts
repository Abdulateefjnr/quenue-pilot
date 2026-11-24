import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { member, user } from "@/app/db/schema";
import { getVerifiedImageType, MAX_IMAGE_SIZE } from "@/app/lib/image-validation";
import { getSession } from "@/app/lib/server-auth";
import { getStorageClient, isStorageConfigured } from "@/app/lib/neon-storage";

const BUCKET = "assets";

async function getVerifiedOrganizationUser(request: Request) {
  const session = await getSession(request.headers);
  if (!session) return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (!session.user.emailVerified) {
    return { response: NextResponse.json({ error: "Email verification required." }, { status: 403 }) };
  }

  const [membership] = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.userId, session.user.id))
    .limit(1);

  if (!membership) {
    return { response: NextResponse.json({ error: "Organization membership required." }, { status: 403 }) };
  }

  return { session };
}

export async function POST(request: Request) {
  const access = await getVerifiedOrganizationUser(request);
  if ("response" in access) return access.response;
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Neon Object Storage is not configured." }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMAGE_SIZE + 64 * 1024) {
    return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 413 });
  }

  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "Choose an image no larger than 5 MB." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = getVerifiedImageType(bytes);
  if (!image) {
    return NextResponse.json({ error: "Only PNG, JPEG, and WebP images are supported." }, { status: 415 });
  }

  const key = `profile/${access.session.user.id}/${randomUUID()}.${image.extension}`;
  await getStorageClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: bytes,
      ContentLength: bytes.byteLength,
      ContentType: image.contentType,
    }),
  );

  await db
    .update(user)
    .set({ image: key })
    .where(eq(user.id, access.session.user.id));

  return NextResponse.json({ success: true });
}

export async function GET(request: Request) {
  const access = await getVerifiedOrganizationUser(request);
  if ("response" in access) return access.response;
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Neon Object Storage is not configured." }, { status: 503 });
  }

  const [profile] = await db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, access.session.user.id))
    .limit(1);

  if (!profile?.image) {
    return NextResponse.json({ error: "No profile photo has been uploaded." }, { status: 404 });
  }

  const prefix = `profile/${access.session.user.id}/`;
  if (!profile.image.startsWith(prefix)) {
    return NextResponse.json({ error: "Stored profile photo is invalid." }, { status: 500 });
  }

  const url = await getSignedUrl(
    getStorageClient(),
    new GetObjectCommand({ Bucket: BUCKET, Key: profile.image }),
    { expiresIn: 300 },
  );

  return NextResponse.json(
    { url },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function DELETE(request: Request) {
  const access = await getVerifiedOrganizationUser(request);
  if ("response" in access) return access.response;
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Neon Object Storage is not configured." }, { status: 503 });
  }

  const [profile] = await db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, access.session.user.id))
    .limit(1);
  if (!profile?.image) return NextResponse.json({ success: true });

  const prefix = `profile/${access.session.user.id}/`;
  if (!profile.image.startsWith(prefix)) {
    return NextResponse.json({ error: "Stored profile photo is invalid." }, { status: 500 });
  }

  await getStorageClient().send(
    new DeleteObjectCommand({ Bucket: BUCKET, Key: profile.image }),
  );
  await db
    .update(user)
    .set({ image: null })
    .where(eq(user.id, access.session.user.id));

  return NextResponse.json({ success: true });
}
