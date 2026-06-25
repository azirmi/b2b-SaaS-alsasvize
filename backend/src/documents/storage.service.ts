import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Presigned URL lifetimes (seconds). */
const UPLOAD_URL_TTL_SECONDS = 15 * 60; // 15 minutes
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60; // 5 minutes

/**
 * Thin wrapper around the S3-compatible object store (MinIO in local dev).
 * Owns the S3 client, ensures the bucket exists on startup, and mints
 * presigned upload/download URLs so files never flow through the API server.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const endpoint = config.getOrThrow<string>('MINIO_ENDPOINT');
    const port = config.getOrThrow<string>('MINIO_PORT');
    const useSSL = config.get<string>('MINIO_USE_SSL') === 'true';
    this.bucket = config.getOrThrow<string>('MINIO_BUCKET');

    this.client = new S3Client({
      // MinIO ignores the region, but the SDK requires one to be set.
      region: config.get<string>('MINIO_REGION') ?? 'us-east-1',
      endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
      forcePathStyle: true, // required for MinIO (path-style addressing)
      credentials: {
        accessKeyId: config.getOrThrow<string>('MINIO_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('MINIO_SECRET_KEY'),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  get uploadTtlSeconds(): number {
    return UPLOAD_URL_TTL_SECONDS;
  }

  get downloadTtlSeconds(): number {
    return DOWNLOAD_URL_TTL_SECONDS;
  }

  /** Presigned PUT URL the client uses to upload an object directly to storage. */
  createUploadUrl(key: string, contentType?: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
  }

  /** Presigned GET URL the client uses to download an object directly. */
  createDownloadUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
    );
  }

  /** Creates the bucket if it does not already exist (idempotent, startup-safe). */
  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" is ready`);
      return;
    } catch {
      // Falls through to creation — the bucket likely doesn't exist yet.
    }

    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created bucket "${this.bucket}"`);
    } catch (error) {
      // Don't crash the app if storage is briefly unavailable; just warn loudly.
      this.logger.error(
        `Could not ensure bucket "${this.bucket}" — document storage may be unavailable`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
