import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Fullstack API',
      version: '1.0.0',
      description: 'Express API with Supabase Auth, Memberships, and Stripe Billing',
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
        UserProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            full_name: { type: 'string', description: 'Computed from first_name + last_name' },
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
        MembershipTier: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            display_name: { type: 'string' },
            description: { type: 'string' },
            price_monthly: { type: 'number' },
            price_yearly: { type: 'number' },
            is_active: { type: 'boolean' },
          },
        },
        UserMembership: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            tier_id: { type: 'string', format: 'uuid' },
            status: {
              type: 'string',
              enum: ['active', 'cancelled', 'expired', 'trial', 'past_due'],
            },
            started_at: { type: 'string', format: 'date-time' },
            expires_at: { type: 'string', format: 'date-time' },
            billing_cycle: { type: 'string', enum: ['monthly', 'yearly'] },
            trial_starts_at: { type: 'string', format: 'date-time', nullable: true },
            trial_ends_at: { type: 'string', format: 'date-time', nullable: true },
            stripe_subscription_id: { type: 'string', nullable: true },
          },
        },
        TrialStatus: {
          type: 'object',
          properties: {
            is_on_trial: { type: 'boolean', description: 'Whether user is currently on trial' },
            trial_starts_at: { type: 'string', format: 'date-time', nullable: true },
            trial_ends_at: { type: 'string', format: 'date-time', nullable: true },
            days_remaining: { type: 'integer', description: 'Days remaining in trial (0 if not on trial)' },
            has_used_trial: { type: 'boolean', description: 'Whether user has ever used a trial' },
            can_start_trial: { type: 'boolean', description: 'Whether user is eligible to start a trial' },
          },
        },
        Feature: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            key: { type: 'string', description: 'Unique feature identifier' },
            name: { type: 'string', description: 'Display name' },
            description: { type: 'string' },
            feature_type: { type: 'string', enum: ['boolean', 'limit', 'enum'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        TierFeature: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tier_id: { type: 'string', format: 'uuid' },
            feature_id: { type: 'string', format: 'uuid' },
            value: { type: 'string', description: 'Feature value (e.g., "true", "10")' },
            usage_limit: { type: 'integer', nullable: true, description: 'Max usage for limit features' },
            period_type: { type: 'string', enum: ['none', 'daily', 'monthly', 'lifetime'] },
          },
        },
        FeatureUsage: {
          type: 'object',
          properties: {
            feature_key: { type: 'string' },
            feature_name: { type: 'string' },
            current_usage: { type: 'integer' },
            usage_limit: { type: 'integer', description: '-1 means unlimited' },
            percentage_used: { type: 'number' },
            period_type: { type: 'string', enum: ['none', 'daily', 'monthly', 'lifetime'] },
            is_exceeded: { type: 'boolean' },
          },
        },
        UsageSummary: {
          type: 'object',
          properties: {
            user_id: { type: 'string', format: 'uuid' },
            tier_name: { type: 'string' },
            features: {
              type: 'array',
              items: { $ref: '#/components/schemas/FeatureUsage' },
            },
          },
        },
        AdminUser: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            role: { type: 'string', enum: ['admin', 'super_admin'] },
            created_at: { type: 'string', format: 'date-time' },
            created_by: { type: 'string', format: 'uuid', nullable: true },
          },
        },
        PaymentHistory: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Stripe payment intent ID' },
            amount: { type: 'integer', description: 'Amount in cents' },
            currency: { type: 'string', example: 'usd' },
            status: { type: 'string', enum: ['succeeded', 'pending', 'failed'] },
            created: { type: 'integer', description: 'Unix timestamp' },
            description: { type: 'string', nullable: true },
          },
        },
        CreateTierInput: {
          type: 'object',
          required: ['name', 'display_name'],
          properties: {
            name: { type: 'string', description: 'Internal tier name (e.g., "premium")' },
            display_name: { type: 'string', description: 'Display name (e.g., "Premium Plan")' },
            description: { type: 'string' },
            price_monthly: { type: 'number', default: 0 },
            price_yearly: { type: 'number', default: 0 },
            stripe_monthly_price_id: { type: 'string' },
            stripe_yearly_price_id: { type: 'string' },
            is_active: { type: 'boolean', default: true },
            sort_order: { type: 'integer', default: 0 },
          },
        },
        UpdateTierInput: {
          type: 'object',
          properties: {
            display_name: { type: 'string' },
            description: { type: 'string' },
            price_monthly: { type: 'number' },
            price_yearly: { type: 'number' },
            stripe_monthly_price_id: { type: 'string' },
            stripe_yearly_price_id: { type: 'string' },
            is_active: { type: 'boolean' },
            sort_order: { type: 'integer' },
          },
        },
        CreateFeatureInput: {
          type: 'object',
          required: ['key', 'name', 'feature_type'],
          properties: {
            key: { type: 'string', description: 'Unique feature key (e.g., "advanced_analytics")' },
            name: { type: 'string', description: 'Display name' },
            description: { type: 'string' },
            feature_type: { type: 'string', enum: ['boolean', 'limit', 'enum'] },
          },
        },
        UpdateFeatureInput: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            feature_type: { type: 'string', enum: ['boolean', 'limit', 'enum'] },
          },
        },
        SetTierFeatureInput: {
          type: 'object',
          required: ['feature_id', 'value'],
          properties: {
            feature_id: { type: 'string', format: 'uuid' },
            value: { type: 'string', description: 'Feature value (e.g., "true", "10", "advanced")' },
            usage_limit: { type: 'integer', nullable: true, description: 'Max usage for limit features' },
            period_type: { type: 'string', enum: ['none', 'daily', 'monthly', 'lifetime'], default: 'none' },
          },
        },
        CheckoutSessionInput: {
          type: 'object',
          required: ['tier_id', 'billing_cycle'],
          properties: {
            tier_id: { type: 'string', format: 'uuid' },
            billing_cycle: { type: 'string', enum: ['monthly', 'yearly'] },
          },
        },
        ConvertTrialInput: {
          type: 'object',
          required: ['tier_id', 'billing_cycle'],
          properties: {
            tier_id: { type: 'string', format: 'uuid' },
            billing_cycle: { type: 'string', enum: ['monthly', 'yearly'] },
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
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
