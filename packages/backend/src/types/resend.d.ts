// Type declaration for optional resend module
// This prevents TypeScript errors when resend is not installed
declare module 'resend' {
  export class Resend {
    constructor(apiKey: string);
    emails: {
      send(options: {
        from: string;
        to: string;
        replyTo?: string;
        subject: string;
        html?: string;
        text?: string;
      }): Promise<{ id: string }>;
    };
  }
}
