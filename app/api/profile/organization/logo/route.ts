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
import { organization } from "@/app/db/schema";
import { getApiOrganizationContext } from "@/app/lib/api-organization";
import { getVerifiedImageType, MAX_IMAGE_SIZE } from "@/app/lib/image-validation";
import { hasPermission } from "@/app/lib/permissions";
import { getStorageClient, isStorageConfigured } from "@/app/lib/neon-storage";

const BUCKET = "assets";

export async function GET(request: Request) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  if (!hasPermission(result.context.role, "organization:read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [facility] = await db
    .select({ logo: organization.logo })
    .from(organization)
    .where(eq(organization.id, result.context.organizationId))
    .limit(1);
  if (!facility?.logo) {
    return NextResponse.json({ error: "No facility logo has been uploaded." }, { status: 404 });
  }
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Neon Object Storage is not configured." }, { status: 503 });
  }

  const prefix = `organization/${result.context.organizationId}/logo/`;
  if (!facility.logo.startsWith(prefix)) {
    return NextResponse.json({ error: "Stored facility logo is invalid." }, { status: 500 });
  }

  const url = await getSignedUrl(
    getStorageClient(),
    new GetObjectCommand({ Bucket: BUCKET, Key: facility.logo }),
    { expiresIn: 300 },
  );
  return NextResponse.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  if (!hasPermission(result.context.role, "organization:update")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Neon Object Storage is not configured." }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMAGE_SIZE + 64 * 1024) {
    return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 413 });
  }

  const form = await request.formData();
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "Choose an image no larger than 5 MB." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = getVerifiedImageType(bytes);
  if (!image) {
    return NextResponse.json({ error: "Only PNG, JPEG, and WebP images are supported." }, { status: 415 });
  }

  const key = `organization/${result.context.organizationId}/logo/${randomUUID()}.${image.extension}`;
  await getStorageClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: bytes,
      ContentLength: bytes.byteLength,
      ContentType: image.contentType,
    }),
  );

  const [updatedFacility] = await db
    .update(organization)
    .set({ logo: key })
    .where(eq(organization.id, result.context.organizationId))
    .returning({ id: organization.id });
  if (!updatedFacility) {
    return NextResponse.json({ error: "Facility profile not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  if (!hasPermission(result.context.role, "organization:update")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [facility] = await db
    .select({ logo: organization.logo })
    .from(organization)
    .where(eq(organization.id, result.context.organizationId))
    .limit(1);
  if (!facility) {
    return NextResponse.json({ error: "Facility profile not found." }, { status: 404 });
  }
  if (!facility.logo) return NextResponse.json({ success: true });

  const prefix = `organization/${result.context.organizationId}/logo/`;
  if (facility.logo.startsWith(prefix) && !isStorageConfigured()) {
    return NextResponse.json({ error: "Neon Object Storage is not configured." }, { status: 503 });
  }

  await db
    .update(organization)
    .set({ logo: null })
    .where(eq(organization.id, result.context.organizationId));

  if (facility.logo.startsWith(prefix)) {
    await getStorageClient().send(
      new DeleteObjectCommand({ Bucket: BUCKET, Key: facility.logo }),
    );
  }

  return NextResponse.json({ success: true });
}
