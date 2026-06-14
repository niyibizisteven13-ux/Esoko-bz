import { apiGet, apiPost, apiPut } from './apiClient';
import { generateReceipt, ReceiptData } from '../lib/pdfGenerator';
import { sendEmail } from '../services/emailService';

interface PurchaseData {
  id: string;
  customerId: string;
  traderId: string;
  productName: string;
  amount: number;
  quantity: number;
  timestamp?: any;
  createdAt?: any;
  status: string;
  customerEmail?: string;
  customerName?: string;
  traderName?: string;
  traderEmail?: string;
}

class AutoReceiptService {
  private static instance: AutoReceiptService;
  private processingQueue: Set<string> = new Set();

  static getInstance(): AutoReceiptService {
    if (!AutoReceiptService.instance) {
      AutoReceiptService.instance = new AutoReceiptService();
    }
    return AutoReceiptService.instance;
  }

  /**
   * Automatically generates and sends receipt when a purchase is approved
   */
  async processApprovedPurchase(purchaseData: PurchaseData): Promise<void> {
    const purchaseId = purchaseData.id;

    if (this.processingQueue.has(purchaseId)) {
      console.log(`Receipt already being processed for purchase ${purchaseId}`);
      return;
    }

    this.processingQueue.add(purchaseId);

    try {
      console.log(`Processing receipt for approved purchase: ${purchaseId}`);
      const enrichedData = await this.enrichPurchaseData(purchaseData);

      const receiptDate =
        enrichedData.timestamp instanceof Date
          ? enrichedData.timestamp
          : enrichedData.timestamp?.toDate?.() instanceof Date
          ? enrichedData.timestamp.toDate()
          : new Date(enrichedData.timestamp || enrichedData.createdAt || Date.now());

      const receiptData: ReceiptData = {
        receiptNumber: `RCP-${purchaseId.slice(-8).toUpperCase()}`,
        date: receiptDate.toLocaleString(),
        customerName: enrichedData.customerName || 'Valued Customer',
        customerEmail: enrichedData.customerEmail,
        traderName: enrichedData.traderName || 'ESOKO Merchant',
        traderEmail: enrichedData.traderEmail,
        items: [
          {
            name: enrichedData.productName,
            quantity: enrichedData.quantity,
            price: enrichedData.amount / Math.max(1, enrichedData.quantity),
            total: enrichedData.amount,
          },
        ],
        subtotal: enrichedData.amount,
        tax: 0,
        total: enrichedData.amount,
        amount: enrichedData.amount,
        type: 'purchase',
        method: 'mobile_payment',
        status: 'completed',
        paymentMethod: 'Mobile Payment',
        senderName: enrichedData.customerName || 'Valued Customer',
        recipientName: enrichedData.traderName || 'ESOKO Merchant',
        productName: enrichedData.productName,
        quantity: enrichedData.quantity,
        transactionId: purchaseId,
      };

      const pdfBlob = generateReceipt(receiptData, { save: false });
      await this.storeReceipt(purchaseId, receiptData, pdfBlob);

      if (enrichedData.customerEmail) {
        await this.sendEmailReceipt(enrichedData.customerEmail, receiptData, pdfBlob);
      }

      await apiPut(`/api/purchases/${encodeURIComponent(purchaseId)}`, {
        receiptGenerated: 1,
        receiptGeneratedAt: new Date().toISOString(),
        receiptId: `receipt_${purchaseId}`,
      });

      console.log(`Receipt processed successfully for purchase: ${purchaseId}`);
    } catch (error) {
      console.error(`Failed to process receipt for purchase ${purchaseId}:`, error);
      try {
        await apiPut(`/api/purchases/${encodeURIComponent(purchaseId)}`, {
          receiptGenerationFailed: 1,
          receiptError: error instanceof Error ? error.message : 'Unknown receipt generation error',
          receiptErrorAt: new Date().toISOString(),
        });
      } catch (updateError) {
        console.error(`Failed to mark receipt failure for purchase ${purchaseId}:`, updateError);
      }
    } finally {
      this.processingQueue.delete(purchaseId);
    }
  }

  private async enrichPurchaseData(purchaseData: PurchaseData): Promise<PurchaseData> {
    const enriched = { ...purchaseData };

    if (purchaseData.customerId && !enriched.customerEmail) {
      try {
        const customerResponse = await apiGet<{ user: any }>(
          `/api/users/${encodeURIComponent(purchaseData.customerId)}`
        );
        if (customerResponse?.user) {
          enriched.customerEmail = customerResponse.user.email;
          enriched.customerName = customerResponse.user.displayName || customerResponse.user.name;
        }
      } catch (error) {
        console.warn('Failed to fetch customer data:', error);
      }
    }

    if (purchaseData.traderId && !enriched.traderEmail) {
      try {
        const traderResponse = await apiGet<{ user: any }>(
          `/api/users/${encodeURIComponent(purchaseData.traderId)}`
        );
        if (traderResponse?.user) {
          enriched.traderEmail = traderResponse.user.email;
          enriched.traderName =
            traderResponse.user.businessName || traderResponse.user.displayName || traderResponse.user.name;
        }
      } catch (error) {
        console.warn('Failed to fetch trader data:', error);
      }
    }

    return enriched;
  }

  private async storeReceipt(purchaseId: string, receiptData: any, pdfBlob: Blob): Promise<void> {
    const pdfBase64 = await this.blobToBase64(pdfBlob);
    const contentBase64 = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;

    await apiPost('/api/receipts', {
      purchaseId,
      receiptData,
      pdfData: contentBase64,
      generatedAt: new Date().toISOString(),
      status: 'generated',
    });
  }

  private async sendEmailReceipt(email: string, receiptData: any, pdfBlob: Blob): Promise<void> {
    try {
      const subject = `Receipt for your purchase - ${receiptData.receiptNumber}`;
      const htmlBody = this.generateReceiptEmailHTML(receiptData);
      const pdfBase64 = await this.blobToBase64(pdfBlob);
      const contentBase64 = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;

      await sendEmail({
        to: email,
        message: {
          subject,
          html: htmlBody,
          attachments: [
            {
              filename: `ESOKO_Receipt_${receiptData.transactionId}.pdf`,
              contentBase64,
              contentType: 'application/pdf',
            },
          ],
        },
      });

      console.log(`Receipt email sent to ${email}`);
    } catch (error) {
      console.error('Failed to send receipt email:', error);
    }
  }

  private generateReceiptEmailHTML(receiptData: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">ESOKO Receipt</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Thank you for your purchase!</p>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 10px 0; color: #374151;">Receipt Details</h2>
            <p style="margin: 5px 0;"><strong>Receipt Number:</strong> ${receiptData.receiptNumber}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${receiptData.date}</p>
            <p style="margin: 5px 0;"><strong>Merchant:</strong> ${receiptData.traderName}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Item</th>
                <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">Qty</th>
                <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: right;">Price</th>
                <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${receiptData.items
                .map(
                  (item: any) => `
                <tr>
                  <td style="border: 1px solid #e5e7eb; padding: 10px;">${item.name}</td>
                  <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">${item.quantity}</td>
                  <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: right;">RWF ${item.price.toLocaleString()}</td>
                  <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: right;">RWF ${item.total.toLocaleString()}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <div style="text-align: right; margin-bottom: 30px;">
            <p style="margin: 5px 0;"><strong>Subtotal:</strong> RWF ${receiptData.subtotal.toLocaleString()}</p>
            <p style="margin: 5px 0; font-size: 18px; color: #f97316;"><strong>Total:</strong> RWF ${receiptData.total.toLocaleString()}</p>
          </div>

          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px;">
            <p style="margin: 0; color: #92400e;">
              <strong>Payment Method:</strong> ${receiptData.paymentMethod}<br>
              <strong>Transaction ID:</strong> ${receiptData.transactionId}
            </p>
          </div>
        </div>
      </div>
    `;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async getReceipt(purchaseId: string): Promise<any> {
    const response = await apiGet<{ receipts: any[] }>('/api/receipts', {
      params: { purchaseId },
    });
    return (response.receipts || [])[0] || null;
  }

  async generateReceiptManually(purchaseId: string): Promise<void> {
    const response = await apiGet<{ purchase: PurchaseData }>(
      `/api/purchases/${encodeURIComponent(purchaseId)}`
    );

    const purchaseData = response.purchase;
    if (!purchaseData) {
      throw new Error('Purchase not found');
    }

    await this.processApprovedPurchase(purchaseData);
  }
}

export const autoReceiptService = AutoReceiptService.getInstance();
