import {
  Controller,
  Get,
  HttpStatus,
  Injectable,
  Module,
  Param,
  ParseFilePipeBuilder,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  Global,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { type AuthUser, CurrentUser } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from './storage.service.js';

const MB = 1024 * 1024;

/** What each upload purpose accepts. Private files are never publicly reachable. */
export const UPLOAD_PURPOSES = {
  product_image: { types: ['jpeg', 'png', 'webp'], maxBytes: 5 * MB, isPrivate: false },
  shop_logo: { types: ['jpeg', 'png', 'webp'], maxBytes: 2 * MB, isPrivate: false },
  shop_banner: { types: ['jpeg', 'png', 'webp'], maxBytes: 5 * MB, isPrivate: false },
  seller_document: { types: ['jpeg', 'png', 'pdf'], maxBytes: 10 * MB, isPrivate: true },
  match_evidence: { types: ['jpeg', 'png', 'webp', 'pdf'], maxBytes: 10 * MB, isPrivate: true },
  // Bank transfer receipts; only the payer and payments staff can open them.
  payment_proof: { types: ['jpeg', 'png', 'webp', 'pdf'], maxBytes: 10 * MB, isPrivate: true },
  tournament_banner: { types: ['jpeg', 'png', 'webp'], maxBytes: 5 * MB, isPrivate: false },
  event_banner: { types: ['jpeg', 'png', 'webp'], maxBytes: 5 * MB, isPrivate: false },
  // A photo or logo printed on a custom kite design; shops quoting the design need to see it.
  design_asset: { types: ['jpeg', 'png', 'webp'], maxBytes: 5 * MB, isPrivate: false },
  // Community posts: photos up to 8 MB (checked below), videos up to 50 MB.
  post_media: { types: ['jpeg', 'png', 'webp', 'mp4', 'mov', 'webm'], maxBytes: 50 * MB, isPrivate: false },
} as const;
export type UploadPurpose = keyof typeof UPLOAD_PURPOSES;

const MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};
const EXTENSION: Record<string, string> = { jpeg: 'jpg', png: 'png', webp: 'webp', pdf: 'pdf', mp4: 'mp4', mov: 'mov', webm: 'webm' };
const IMAGE_MAX_BYTES = 8 * MB;
export const isVideoMime = (mime: string) => mime.startsWith('video/');

/** Detects the real file type from its first bytes; the browser-supplied MIME type is not trusted. */
export function sniffType(buf: Buffer): keyof typeof MIME | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') return 'pdf';
  // ISO base media: "ftyp" box at offset 4; QuickTime declares brand "qt  ".
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') return buf.toString('ascii', 8, 12) === 'qt  ' ? 'mov' : 'mp4';
  if (buf.length >= 4 && buf.readUInt32BE(0) === 0x1a45dfa3) return 'webm';
  return null;
}

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async save(ownerId: string, purpose: UploadPurpose, file: Express.Multer.File) {
    const rule = UPLOAD_PURPOSES[purpose];
    const type = sniffType(file.buffer);
    if (!type || !(rule.types as readonly string[]).includes(type)) {
      throw new AppException('FILE_TYPE_NOT_ALLOWED', `Upload a ${rule.types.join(', ').toUpperCase()} file.`, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    const limit = isVideoMime(MIME[type]) ? rule.maxBytes : Math.min(rule.maxBytes, IMAGE_MAX_BYTES);
    if (file.size > limit) {
      throw new AppException('FILE_TOO_LARGE', `${isVideoMime(MIME[type]) ? 'Videos' : 'Files'} can be at most ${limit / MB} MB.`, HttpStatus.PAYLOAD_TOO_LARGE);
    }
    const stored = await this.storage.put(file.buffer, EXTENSION[type], { isPrivate: rule.isPrivate, folder: purpose });
    const row = await this.prisma.upload.create({
      data: {
        ownerId,
        purpose,
        storageKey: stored.key,
        url: stored.url,
        mimeType: MIME[type],
        size: file.size,
        originalName: file.originalname.slice(0, 200),
        isPrivate: rule.isPrivate,
      },
    });
    return { id: row.id, url: row.url, mimeType: row.mimeType, size: row.size, originalName: row.originalName };
  }

  /** Returns the caller's uploads with these ids and purpose, or throws if any is missing or someone else's. */
  async ownedUploads(ownerId: string, ids: string[], purpose: UploadPurpose) {
    if (!ids.length) return [];
    const rows = await this.prisma.upload.findMany({ where: { id: { in: ids }, ownerId, purpose } });
    if (rows.length !== new Set(ids).size) {
      throw new AppException('UPLOAD_NOT_FOUND', 'One of the files could not be found. Please upload it again.');
    }
    return ids.map((id) => rows.find((r) => r.id === id)!);
  }
}

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'purpose', enum: Object.keys(UPLOAD_PURPOSES) })
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * MB, files: 1 } }))
  upload(
    @CurrentUser() user: AuthUser,
    @Query('purpose') purpose: string,
    @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: true, errorHttpStatusCode: HttpStatus.BAD_REQUEST }))
    file: Express.Multer.File,
  ) {
    if (!(purpose in UPLOAD_PURPOSES)) throw new AppException('INVALID_PURPOSE', 'Unknown upload type.');
    return this.uploads.save(user.id, purpose as UploadPurpose, file);
  }

  /** Private files: only the owner and the staff who need them can open them. */
  @Get(':id/file')
  async file(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const upload = await this.prisma.upload.findUnique({ where: { id } });
    // Seller documents: reviewers. Match evidence: tournament staff. Payment receipts: payments staff.
    const staffPermission =
      upload?.purpose === 'match_evidence'
        ? PERMISSIONS.TOURNAMENTS_MANAGE
        : upload?.purpose === 'payment_proof'
          ? PERMISSIONS.PAYMENTS_MANAGE
          : PERMISSIONS.SELLERS_REVIEW;
    const allowed = upload && (upload.ownerId === user.id || user.permissions.has(staffPermission));
    if (!upload || !allowed) throw Errors.notFound('File');
    res.set({
      'Content-Type': upload.mimeType,
      'Content-Disposition': `inline; filename="${upload.originalName.replace(/[^\w.\- ]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(this.storage.read(upload.storageKey));
  }
}

@Global()
@Module({
  controllers: [UploadsController],
  providers: [StorageService, UploadsService],
  exports: [StorageService, UploadsService],
})
export class StorageModule {}
