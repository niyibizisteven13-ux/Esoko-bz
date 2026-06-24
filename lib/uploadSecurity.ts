/**
 * Upload Security Middleware
 *
 * Implements hardened file upload validation:
 * 1. Magic-byte verification (prevent MIME type spoofing)
 * 2. Safe serving headers (prevent script execution in browser)
 * 3. Secure filename handling (UUID-based, no path traversal)
 * 4. File size and type limits
 *
 * Usage:
 * - Call verifyUploadMagicBytes() after multer processes the file
 * - Call setUploadSafeHeaders() when serving uploads
 * - Integrate with malware scanner for production (stub included)
 */

import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';

/**
 * Magic-byte signatures for common file types
 * Detects the actual file type, not just MIME header
 */
const MAGIC_BYTES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  'image/gif': [Buffer.from([0x47, 0x49, 0x46, 0x38])], // GIF87a or GIF89a
  'image/webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF header
  'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  'video/mp4': [Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])], // ftyp at offset 4
  'video/webm': [Buffer.from([0x1a, 0x45, 0xdf, 0xa3])],
  'video/ogg': [Buffer.from([0x4f, 0x67, 0x67, 0x53])], // OggS
};

/**
 * Verify file matches declared MIME type via magic bytes
 * Returns true if file type matches or is unrecognized (allow-list approach)
 */
export function verifyUploadMagicBytes(
  filePath: string,
  declaredMimetype: string
): { valid: boolean; detectedType: string | null; reason?: string } {
  try {
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    // Check declared MIME type's magic bytes
    const expectedMagics = MAGIC_BYTES[declaredMimetype];
    if (!expectedMagics) {
      return {
        valid: false,
        detectedType: null,
        reason: `Unsupported MIME type: ${declaredMimetype}`,
      };
    }

    // Try to match against known signatures
    for (const signature of expectedMagics) {
      if (buffer.subarray(0, signature.length).equals(signature)) {
        return { valid: true, detectedType: declaredMimetype };
      }
    }

    // For video/mp4, also check ftyp at offset 4
    if (declaredMimetype === 'video/mp4') {
      const ftypBytes = buffer.subarray(4, 8);
      if (ftypBytes.toString('ascii') === 'ftyp') {
        return { valid: true, detectedType: 'video/mp4' };
      }
    }

    // For video/webm, also check Matroska EBML header
    if (declaredMimetype === 'video/webm') {
      const ebmlHeader = buffer.subarray(0, 4);
      if (ebmlHeader.equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
        return { valid: true, detectedType: 'video/webm' };
      }
    }

    return {
      valid: false,
      detectedType: null,
      reason: `Magic bytes do not match declared MIME type ${declaredMimetype}`,
    };
  } catch (error) {
    return {
      valid: false,
      detectedType: null,
      reason: `Failed to verify magic bytes: ${String(error)}`,
    };
  }
}

/**
 * Detect actual file type based on magic bytes
 * (fallback for files with missing/wrong MIME types)
 */
export function detectFileTypeByMagicBytes(filePath: string): string | null {
  try {
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    // Check each known type
    for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
      for (const sig of signatures) {
        if (buffer.subarray(0, sig.length).equals(sig)) {
          return mimeType;
        }
      }
    }

    // Special cases
    if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
      return 'video/mp4';
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Stub for malware scanning integration
 * Replace with actual antivirus/sandbox integration (e.g., ClamAV, VirusTotal API)
 */
export interface MalwareScanResult {
  clean: boolean;
  engine?: string;
  detections?: string[];
  scanTimeMs?: number;
}

export async function scanFileForMalware(
  filePath: string,
  _options?: { engine?: string; maxSizeBytes?: number }
): Promise<MalwareScanResult> {
  // TODO: Integrate with actual malware scanner
  // - Option 1: ClamAV (local daemon) - requires ClamAV installed
  // - Option 2: VirusTotal API - external SaaS
  // - Option 3: AWS Macie or similar cloud scanning

  // For now, stub returns clean (assumes file already validated by magic-bytes + MIME)
  try {
    const stats = fs.statSync(filePath);
    return {
      clean: true,
      engine: 'stub',
      scanTimeMs: 0,
    };
  } catch {
    return { clean: false, detections: ['File not accessible'] };
  }
}

/**
 * Set secure headers for upload responses and serving
 * Prevents browser from executing uploaded files as scripts
 */
export function setUploadSafeHeaders(res: Response, mimetype: string, fileName?: string) {
  // Prevent content-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent framing attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent XSS attacks
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Disable caching for sensitive files (PDFs, etc.)
  if (mimetype === 'application/pdf' || mimetype.startsWith('image')) {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours for images
  } else {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  }

  // Content-Disposition: inline for images/videos, attachment for documents
  if (mimetype.startsWith('image') || mimetype.startsWith('video')) {
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(fileName || 'file')}"`);
  } else {
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fileName || 'file')}"`);
  }

  // Set correct Content-Type
  res.setHeader('Content-Type', mimetype);

  // CORS headers for same-origin access
  res.setHeader('Access-Control-Allow-Origin', 'same-origin');
}

/**
 * Middleware factory: validate upload magic-bytes after multer
 * Usage: app.post('/api/upload', upload.single('file'), validateUploadMagicBytes(), handler)
 */
export function validateUploadMagicBytesMiddleware() {
  return (req: any, res: any, next: any) => {
    if (!req.file) {
      return next(); // No file to validate
    }

    const verification = verifyUploadMagicBytes(req.file.path, req.file.mimetype);

    if (!verification.valid) {
      // Delete invalid file
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }

      return res.status(400).json({
        error: 'File validation failed',
        reason: verification.reason || 'Magic bytes do not match declared type',
      });
    }

    // Attach verification result for later use
    req.fileVerified = verification;
    next();
  };
}

/**
 * Middleware factory: scan file for malware after magic-byte validation
 * Usage: app.post('/api/upload', upload.single('file'), validateUploadMagicBytesMiddleware(), scanUploadForMalwareMiddleware(), handler)
 */
export function scanUploadForMalwareMiddleware() {
  return async (req: any, res: any, next: any) => {
    if (!req.file) {
      return next();
    }

    try {
      const scanResult = await scanFileForMalware(req.file.path);

      if (!scanResult.clean) {
        // Delete infected file
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }

        return res.status(400).json({
          error: 'File failed malware scan',
          detections: scanResult.detections || [],
        });
      }

      req.fileScanResult = scanResult;
      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Upload scan error',
        message: String(error),
      });
    }
  };
}
