import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { bugReportSchema } from '../validation/bug-report.schemas.js';
import { bugReportService } from '../services/bug-report.service.js';
import { bugReportRateLimit } from '../middleware/rateLimit.middleware.js';
import { ApiError } from '../middleware/error.middleware.js';

const router = Router();

// Multer — memory storage, no disk writes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
    files: 5,
  },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ApiError(
          400,
          `Invalid file type: ${file.mimetype}. Only JPEG, PNG, GIF and WebP are allowed.`
        )
      );
    }
  },
});

/**
 * @swagger
 * /api/bug-reports:
 *   post:
 *     summary: Submit a bug report
 *     description: >
 *       Public endpoint — no authentication required.
 *       Accepts a multipart/form-data body with text fields and optional image attachments (JPEG, PNG, GIF, WebP).
 *       Rate limited to 5 requests per 15 minutes per IP.
 *     tags: [Bug Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *             properties:
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *                 description: Description of the bug
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: Reporter's name (optional)
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Reporter's email for follow-up (optional)
 *               page_url:
 *                 type: string
 *                 format: uri
 *                 description: URL of the page where the bug occurred (captured automatically)
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Up to 5 image attachments (max 10 MB each; JPEG, PNG, GIF, WebP)
 *     responses:
 *       200:
 *         description: Bug report submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Thank you for your bug report! We will investigate and address the issue.
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     images_uploaded:
 *                       type: integer
 *                       description: Number of images successfully uploaded
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded (5 requests per 15 minutes)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/',
  bugReportRateLimit,
  upload.array('images', 5),
  async (req: Request, res: Response): Promise<void> => {
    // Parse and validate the text fields
    const parsed = bugReportSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      res
        .status(400)
        .json({ success: false, error: firstError.message, details: parsed.error.errors });
      return;
    }

    const files = (req.files as Express.Multer.File[]) ?? [];
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    const { report, images_uploaded } = await bugReportService.submitBugReport(
      parsed.data,
      files,
      ipAddress,
      userAgent
    );

    res.status(200).json({
      success: true,
      message: 'Thank you for your bug report! We will investigate and address the issue.',
      data: {
        id: report.id,
        images_uploaded,
      },
    });
  }
);

export default router;
