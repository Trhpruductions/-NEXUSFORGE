import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

const canUseStorage =
  Boolean(env.S3_BUCKET_NAME) && Boolean(env.S3_ACCESS_KEY_ID) && Boolean(env.S3_SECRET_ACCESS_KEY);

const s3Client = canUseStorage
  ? new S3Client({
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: Boolean(env.S3_ENDPOINT),
    })
  : null;

export function storageConfigured(): boolean {
  return Boolean(s3Client && env.S3_BUCKET_NAME);
}

export async function createUploadUrl(input: {
  userId: string;
  filename: string;
  contentType: string;
  maxBytes: number;
}): Promise<{ key: string; uploadUrl: string; fileUrl: string }> {
  if (!s3Client || !env.S3_BUCKET_NAME) {
    throw new Error("Storage is not configured");
  }

  const safeFileName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `uploads/${input.userId}/${Date.now()}-${randomUUID()}-${safeFileName}`;

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    ContentType: input.contentType,
    Metadata: {
      uploader: input.userId,
      maxBytes: String(input.maxBytes),
    },
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 * 5 });

  const fileUrl = env.S3_PUBLIC_BASE_URL
    ? `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`
    : env.S3_ENDPOINT
      ? `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET_NAME}/${key}`
      : `https://${env.S3_BUCKET_NAME}.s3.${env.S3_REGION}.amazonaws.com/${key}`;

  return { key, uploadUrl, fileUrl };
}
