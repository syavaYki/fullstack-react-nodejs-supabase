import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.js';
import { branding } from './branding.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: branding.apiTitle,
      version: '1.0.0',
      description: branding.apiDescription,
    },
    servers: [
      {
        url: env.BACKEND_URL,
        description: env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Supabase access token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
          },
        },
        BugReport: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', nullable: true },
            email: { type: 'string', format: 'email', nullable: true },
            description: { type: 'string' },
            page_url: { type: 'string', format: 'uri', nullable: true },
            images: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  url: { type: 'string', format: 'uri' },
                  size: { type: 'integer' },
                  uploaded_at: { type: 'string', format: 'date-time' },
                },
              },
            },
            status: { type: 'string', enum: ['new', 'in_progress', 'resolved', 'wont_fix'] },
            ip_address: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        UserProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            full_name: { type: 'string' },
            avatar_url: { type: 'string' },
            phone: { type: 'string' },
            company: { type: 'string' },
            bio: { type: 'string' },
            website: { type: 'string' },
            stripe_customer_id: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication and session management' },
      { name: 'Profile', description: 'User profile management' },
      { name: 'Membership', description: 'Tiers, features, usage, and trial management' },
      { name: 'Billing', description: 'Stripe billing and subscription management' },
      { name: 'Contact', description: 'Contact form submission' },
      { name: 'Newsletter', description: 'Newsletter subscription' },
      { name: 'Bug Reports', description: 'Bug report submission with optional image attachments' },
    ],
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
