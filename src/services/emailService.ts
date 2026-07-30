import { apiPost } from './apiClient';

export interface EmailPayload {
  to: string;
  message: {
    subject: string;
    text?: string;
    html: string;
    attachments?: Array<{
      filename: string;
      contentBase64: string;
      contentType: string;
    }>;
  };
  metadata?: any;
}

export const EmailTemplates = {
  transaction: (type: string, amount: number, status: string) => ({
    message: {
      subject: `Transaction ${status.toUpperCase()}: ${type.toUpperCase()}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Transaction Update</h2>
          <p>Your ${type} of <strong>RWF ${amount.toLocaleString()}</strong> has been marked as <strong>${status}</strong>.</p>
          <p>Thank you for using Nexus.</p>
        </div>
      `,
    },
  }),
};

export const sendEmail = async (payload: any) => {
  try {
    await apiPost('/api/emails', {
      ...payload,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[EmailService] Failed to queue email:', error);
  }
};

class EmailService {
  private async sendMail(payload: EmailPayload) {
    await sendEmail(payload);
  }

  async sendWelcomeEmail(email: string, name: string, role: string = 'customer') {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nexus.rw';
    const isTrader = role === 'trader';
    const verificationUrl = `${origin}/verify-account?role=${encodeURIComponent(role)}#documents`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h1 style="color: #ea580c;">Welcome to Nexus, ${name}!</h1>
        <p>We're thrilled to have you on board. Here's how to get started with your new digital wallet:</p>
        <ul>
          <li><strong>Deposit:</strong> Visit any Nexus Agent to cash in.</li>
          <li><strong>Payments:</strong> Pay at any registered Trader using your App ID.</li>
          <li><strong>Transfers:</strong> Send money instantly to friends and family.</li>
          <li><strong>Rewards:</strong> Earn loyalty points on every transaction.</li>
        </ul>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:16px;margin:20px 0;">
          <h2 style="font-size:16px;margin:0 0 8px;color:#9a3412;">Optional verified badge</h2>
          <p style="margin:0 0 12px;">
            ${
              isTrader
                ? 'Your account is ready after email verification. Later, you can upload business documents if you want a verified trader badge and stronger shop trust.'
                : 'Your account is ready after email verification. Later, you can verify your identity if you want a verified badge or higher trust features.'
            }
          </p>
          <p><a href="${verificationUrl}" style="background:#111827;color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700;">${isTrader ? 'Get Trader Verified' : 'Get Verified'}</a></p>
          <p style="font-size:12px;color:#9a3412;">Document upload is optional for normal account creation. Only upload documents through official Bwenge links after signing in.</p>
        </div>
        <p>If you have any questions, our support team is available 24/7 in the app.</p>
        <p>Best regards,<br/>The Nexus Team</p>
      </div>
    `;
    await this.sendMail({
      to: email,
      message: {
        subject: 'Welcome to Nexus - Your Financial Journey Starts Here',
        html,
      },
    });
  }

  async sendTeamMemberInvite(
    email: string,
    name: string,
    password: string,
    role: string,
    loginUrl?: string
  ) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nexus.rw';
    const accessUrl = loginUrl || `${origin}/login`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h1 style="color: #ea580c;">Welcome to Nexus, ${name}</h1>
        <p>Your account has been created with the following credentials:</p>
        <ul>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Password:</strong> ${password}</li>
          <li><strong>Role:</strong> ${role}</li>
        </ul>
        <p>Please keep these details secure. You can log in at:</p>
        <p><a href="${accessUrl}" style="color: #ea580c; text-decoration: none;">${accessUrl}</a></p>
        <p>After logging in, update your password immediately and contact your manager if you need help.</p>
        <p>Best regards,<br/>The Nexus Team</p>
      </div>
    `;

    await this.sendMail({
      to: email,
      message: {
        subject: 'Your Nexus team access credentials are ready',
        html,
      },
    });
  }

  async sendLoginAlert(email: string, name: string, metadata?: any) {
    try {
      const time = new Date().toLocaleString();
      const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown device';
      const loginMethod = metadata?.method || 'Email/Password';
      const userRole = metadata?.role || 'User';
      const accountStatus = metadata?.status || 'Active';
      const ipAddress = metadata?.ip || 'Unknown IP';
      const location = metadata?.location || 'Unknown location';

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #16a34a;">🔐 Login Notification</h2>
            <p style="color: #666; font-size: 12px;">Security Alert</p>
          </div>
          <p style="color: #1f2937; font-size: 14px; margin-bottom: 20px;">Hello ${name},</p>
          
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
            <p style="color: #15803d; margin: 0; font-weight: bold;">✅ Successful Login Detected</p>
          </div>

          <div style="background: #f9fafb; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #666; padding: 5px 0; font-weight: bold;">Time:</td>
                <td style="text-align: right;">${time}</td>
              </tr>
              <tr>
                <td style="color: #666; padding: 5px 0; font-weight: bold;">Method:</td>
                <td style="text-align: right;">${loginMethod}</td>
              </tr>
              <tr>
                <td style="color: #666; padding: 5px 0; font-weight: bold;">Device:</td>
                <td style="text-align: right; font-size: 12px;">${deviceInfo}</td>
              </tr>
              <tr>
                <td style="color: #666; padding: 5px 0; font-weight: bold;">IP Address:</td>
                <td style="text-align: right;">${ipAddress}</td>
              </tr>
              <tr>
                <td style="color: #666; padding: 5px 0; font-weight: bold;">Location:</td>
                <td style="text-align: right;">${location}</td>
              </tr>
              <tr>
                <td style="color: #666; padding: 5px 0; font-weight: bold;">Role:</td>
                <td style="text-align: right;">${userRole}</td>
              </tr>
              <tr>
                <td style="color: #666; padding: 5px 0; font-weight: bold;">Status:</td>
                <td style="text-align: right;">${accountStatus}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 5px; margin-bottom: 15px;">
            <p style="font-size: 12px; color: #92400e; margin: 0;">
              <strong>💡 Security Tip:</strong> If this login wasn't you, please change your password immediately and contact support.
            </p>
          </div>

          <p style="color: #666; font-size: 13px; margin-bottom: 10px;"><strong>Didn't recognize this login?</strong></p>
          <p style="color: #dc2626; font-size: 12px; margin: 10px 0;">
            If you did not attempt to log in, please contact our support team immediately at support@nexus.rw
          </p>

          <p style="font-size: 11px; color: #999; text-align: center; margin-top: 20px;">
            This is an automated security alert from Nexus. <br/>
            Nexus Financial Services - Rwanda <br/>
            <a href="https://nexus.rw" style="color: #0284c7; text-decoration: none;">Visit our website</a>
          </p>
        </div>
      `;
      console.log('📧 Sending enhanced login alert email to:', email);
      await this.sendMail({
        to: email,
        message: {
          subject: '🔐 Security Alert: New Login to Nexus Wallet',
          html,
        },
        metadata,
      });
      console.log('✅ Login alert email sent successfully to:', email);
    } catch (error) {
      console.error('❌ Failed to send login alert email:', error);
      // Don't throw - we don't want to break the login flow
    }
  }

  async sendTransactionReceipt(params: {
    email: string;
    name: string;
    type: 'deposit' | 'withdrawal' | 'transfer' | 'payment';
    amount: number;
    fee: number;
    status: 'success' | 'failed';
    reference: string;
    recipientName?: string;
    oldBalance?: number;
    newBalance?: number;
  }) {
    const {
      email,
      name,
      type,
      amount,
      fee,
      status,
      reference,
      recipientName,
      oldBalance,
      newBalance,
    } = params;
    const color = status === 'success' ? '#16a34a' : '#dc2626';

    const html = `
      <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 15px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: ${color}; margin-bottom: 5px;">Transaction ${status === 'success' ? 'Successful' : 'Failed'}</h2>
          <p style="color: #666; font-size: 12px;">Ref: ${reference}</p>
        </div>
        
        <div style="background: #f9fafb; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #666; padding: 5px 0;">Action</td>
              <td style="text-align: right; font-weight: bold;">${type.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="color: #666; padding: 5px 0;">Amount</td>
              <td style="text-align: right; font-weight: bold;">RWF ${amount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="color: #666; padding: 5px 0;">Service Fee</td>
              <td style="text-align: right; font-weight: bold;">RWF ${fee.toLocaleString()}</td>
            </tr>
            ${
              recipientName
                ? `
            <tr>
              <td style="color: #666; padding: 5px 0;">Recipient</td>
              <td style="text-align: right; font-weight: bold;">${recipientName}</td>
            </tr>
            `
                : ''
            }
            <tr style="border-top: 1px solid #ddd;">
              <td style="padding: 10px 0; font-weight: bold;">Total Deducted</td>
              <td style="text-align: right; font-weight: bold; color: ${color}; font-size: 18px;">RWF ${(amount + fee).toLocaleString()}</td>
            </tr>
            ${
              oldBalance !== undefined
                ? `
            <tr style="background: #f0f9ff; border-top: 2px solid #ddd; border-bottom: 2px solid #ddd;">
              <td style="color: #666; padding: 8px 0;">Balance Before</td>
              <td style="text-align: right; font-weight: bold; color: #0284c7;">RWF ${oldBalance.toLocaleString()}</td>
            </tr>
            `
                : ''
            }
            ${
              newBalance !== undefined
                ? `
            <tr style="background: #f0fdf4;">
              <td style="color: #666; padding: 8px 0;">Balance After</td>
              <td style="text-align: right; font-weight: bold; color: #16a34a; font-size: 16px;">RWF ${newBalance.toLocaleString()}</td>
            </tr>
            `
                : ''
            }
          </table>
        </div>
        
        ${
          type === 'withdrawal' || type === 'transfer'
            ? `
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 5px; margin-bottom: 15px;">
          <p style="font-size: 12px; color: #92400e; margin: 0;">
            <strong>✓ Authenticated via Biometric (Fingerprint)</strong>
          </p>
        </div>
        `
            : `
        <div style="background: #dbeafe; border-left: 4px solid #0284c7; padding: 12px; border-radius: 5px; margin-bottom: 15px;">
          <p style="font-size: 12px; color: #075985; margin: 0;">
            <strong>✓ Free Deposit - No Authentication Required</strong>
          </p>
        </div>
        `
        }
        
        <p style="font-size: 11px; color: #999; text-align: center;">
          This is an automated receipt for your wallet action. <br/>
          Nexus Financial Services - Rwanda
        </p>
      </div>
    `;

    await this.sendMail({
      to: email,
      message: {
        subject: `Transaction Receipt: ${type.toUpperCase()} - ${status.toUpperCase()}`,
        html,
      },
    });
  }

  async sendWalletUnlockEmail(params: {
    email: string;
    name: string;
    unlockLink: string;
    attemptTime: string;
  }) {
    const { email, name, unlockLink, attemptTime } = params;

    const html = `
      <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 15px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #dc2626; margin-bottom: 5px;">⚠️ Wallet Temporarily Locked</h2>
          <p style="color: #666; font-size: 12px;">Security Alert</p>
        </div>
        
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
          <p style="color: #7f1d1d; margin: 0; font-weight: bold;">Your wallet has been temporarily locked due to 3 incorrect PIN attempts.</p>
        </div>

        <div style="background: #f9fafb; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
          <p style="color: #666; margin-bottom: 10px;"><strong>What happened:</strong></p>
          <ul style="color: #666; margin: 10px 0; padding-left: 20px;">
            <li>Failed PIN entry attempts detected at ${attemptTime}</li>
            <li>Wallet locked for security purposes</li>
            <li>No transactions can be made until unlocked</li>
          </ul>
        </div>

        <div style="background: #f0fdf4; border: 2px solid #16a34a; padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
          <p style="color: #15803d; margin-bottom: 15px; font-weight: bold;">Click below to unlock your wallet:</p>
          <a href="${unlockLink}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">🔓 Unlock Wallet</a>
          <p style="color: #666; font-size: 12px; margin-top: 10px;">Or copy this link: <br/><span style="word-break: break-all; color: #0284c7; font-size: 11px;">${unlockLink}</span></p>
        </div>

        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 5px; margin-bottom: 15px;">
          <p style="font-size: 12px; color: #92400e; margin: 0;">
            <strong>💡 Security Tip:</strong> Keep your PIN secure. Never share it with anyone, even Nexus staff.
          </p>
        </div>

        <p style="color: #666; font-size: 13px; margin-bottom: 10px;"><strong>If this wasn't you:</strong></p>
        <p style="color: #dc2626; font-size: 12px; margin: 10px 0;">
          If you did not attempt to access your wallet, please contact our support team immediately at support@nexus.rw
        </p>

        <p style="font-size: 11px; color: #999; text-align: center; margin-top: 20px;">
          This is an automated security alert from Nexus. <br/>
          Nexus Financial Services - Rwanda <br/>
          <a href="https://nexus.rw" style="color: #0284c7; text-decoration: none;">Visit our website</a>
        </p>
      </div>
    `;

    await this.sendMail({
      to: email,
      message: {
        subject: `🔒 Security Alert: Your Nexus Wallet is Locked`,
        html,
      },
    });
  }
}

export const emailService = new EmailService();
