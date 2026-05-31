import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { generateReceipt, ReceiptData } from '../lib/pdfGenerator';
import { sendEmail } from '../services/emailService';

interface PurchaseData {
  id: string;
  customerId: string;
  traderId: string;
  productName: string;
  amount: number;
  quantity: number;
  timestamp: any;
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

    // Prevent duplicate processing
    if (this.processingQueue.has(purchaseId)) {
      console.log(`Receipt already being processed for purchase ${purchaseId}`);
      return;
    }

    this.processingQueue.add(purchaseId);

    try {
      console.log(`Processing receipt for approved purchase: ${purchaseId}`);

      // Get customer and trader details if not provided
      const enrichedData = await this.enrichPurchaseData(purchaseData);

      // Generate receipt PDF
      const receiptDate =
        enrichedData.timestamp?.toDate?.() || new Date(enrichedData.timestamp || Date.now());
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
            price: enrichedData.amount / enrichedData.quantity,
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

      // Generate PDF
      const pdfBlob = generateReceipt(receiptData, { save: false });

      // Store receipt in database
      await this.storeReceipt(purchaseId, receiptData, pdfBlob);

      // Send email receipt if customer email is available
      if (enrichedData.customerEmail) {
        await this.sendEmailReceipt(enrichedData.customerEmail, receiptData, pdfBlob);
      }

      // Update purchase with receipt status
      await updateDoc(doc(db, 'purchases', purchaseId), {
        receiptGenerated: true,
        receiptGeneratedAt: new Date(),
        receiptId: `receipt_${purchaseId}`,
      });

      console.log(`Receipt processed successfully for purchase: ${purchaseId}`);
    } catch (error) {
      console.error(`Failed to process receipt for purchase ${purchaseId}:`, error);

      // Mark as failed but don't retry automatically
      await updateDoc(doc(db, 'purchases', purchaseId), {
        receiptGenerationFailed: true,
        receiptError: error instanceof Error ? error.message : 'Unknown receipt generation error',
        receiptErrorAt: new Date(),
      });
    } finally {
      this.processingQueue.delete(purchaseId);
    }
  }

  /**
   * Enrich purchase data with customer and trader information
   */
  private async enrichPurchaseData(purchaseData: PurchaseData): Promise<PurchaseData> {
    const enriched = { ...purchaseData };

    // Get customer data
    if (purchaseData.customerId && !enriched.customerEmail) {
      try {
        const customerDoc = await getDoc(doc(db, 'users', purchaseData.customerId));
        if (customerDoc.exists()) {
          const customerData = customerDoc.data();
          enriched.customerEmail = customerData.email;
          enriched.customerName = customerData.displayName || customerData.name;
        }
      } catch (error) {
        console.warn('Failed to fetch customer data:', error);
      }
    }

    // Get trader data
    if (purchaseData.traderId && !enriched.traderEmail) {
      try {
        const traderDoc = await getDoc(doc(db, 'users', purchaseData.traderId));
        if (traderDoc.exists()) {
          const traderData = traderDoc.data();
          enriched.traderEmail = traderData.email;
          enriched.traderName =
            traderData.businessName || traderData.displayName || traderData.name;
        }
      } catch (error) {
        console.warn('Failed to fetch trader data:', error);
      }
    }

    return enriched;
  }

  /**
   * Store receipt data in database
   */
  private async storeReceipt(purchaseId: string, receiptData: any, pdfBlob: Blob): Promise<void> {
    // Convert PDF blob to base64 for storage (in production, consider cloud storage)
    const pdfBase64 = await this.blobToBase64(pdfBlob);

    await addDoc(collection(db, 'receipts'), {
      purchaseId,
      receiptData,
      pdfData: pdfBase64,
      generatedAt: new Date(),
      status: 'generated',
    });
  }

  /**
   * Send receipt via email
   */
  private async sendEmailReceipt(email: string, receiptData: any, pdfBlob: Blob): Promise<void> {
    try {
      const subject = `Receipt for your purchase - ${receiptData.receiptNumber}`;
      const htmlBody = this.generateReceiptEmailHTML(receiptData);

      // In a real implementation, you'd upload the PDF to cloud storage and include a download link
      // For now, we'll send the email without attachment
      await sendEmail({
        to: email,
        subject,
        html: htmlBody,
        // attachment: pdfBlob would be added here in production
      });

      console.log(`Receipt email sent to ${email}`);
    } catch (error) {
      console.error('Failed to send receipt email:', error);
      // Don't throw - email failure shouldn't stop the process
    }
  }

  /**
   * Generate HTML email template for receipt
   */
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
            <p style="margin: 5px 0;"><strong>Date:</strong> ${receiptData.date.toLocaleDateString()}</p>
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

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Thank you for shopping with ESOKO! Visit us again soon.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Convert blob to base64 string
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Get receipt for a purchase
   */
  async getReceipt(purchaseId: string): Promise<any> {
    const q = query(collection(db, 'receipts'), where('purchaseId', '==', purchaseId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }

    return null;
  }

  /**
   * Manually trigger receipt generation for a purchase
   */
  async generateReceiptManually(purchaseId: string): Promise<void> {
    const purchaseDoc = await getDoc(doc(db, 'purchases', purchaseId));

    if (!purchaseDoc.exists()) {
      throw new Error('Purchase not found');
    }

    const purchaseData = { id: purchaseId, ...purchaseDoc.data() } as PurchaseData;
    await this.processApprovedPurchase(purchaseData);
  }
}

export const autoReceiptService = AutoReceiptService.getInstance();
