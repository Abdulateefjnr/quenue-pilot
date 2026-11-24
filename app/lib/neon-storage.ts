import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | undefined;

export function isStorageConfigured() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_ENDPOINT_URL_S3 &&
      process.env.AWS_REGION,
  );
}

export function getStorageClient() {
  if (!isStorageConfigured()) {
    throw new Error("Neon Object Storage is not configured.");
  }

  client ??= new S3Client({
    region: process.env.AWS_REGION!,
    endpoint: process.env.AWS_ENDPOINT_URL_S3!,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  return client;
}
