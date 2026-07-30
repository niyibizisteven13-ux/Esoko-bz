import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './utils';

export interface ReceiptData {
  transactionId: string;
  date: string;
  amount: number;
  type?: string;
  method?: string;
  status: string;
  receiptNumber?: string;
  customerName?: string;
  customerEmail?: string;
  traderName?: string;
  traderEmail?: string;
  traderTin?: string;
  traderPhone?: string;
  traderAddress?: string;
  customerPhone?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal?: number;
  tax?: number;
  total?: number;
  paymentMethod?: string;
  senderName?: string;
  recipientName?: string;
  productName?: string;
  quantity?: number;
  businessName?: string;
  tin?: string;
}

export const generateReceipt = (data: ReceiptData, options: { save?: boolean } = {}): Blob => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(234, 88, 12); // Orange-600
  doc.text('Bwenge WALLET', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Official Digital Receipt', pageWidth / 2, 28, { align: 'center' });

  // Divider
  doc.setDrawColor(230);
  doc.line(20, 35, pageWidth - 20, 35);

  // Transaction Info
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('Transaction Details', 20, 45);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const details = [
    ['Receipt ID:', data.transactionId],
    ['Date:', data.date],
    ['Type:', (data.type || 'sale').toUpperCase()],
    ['Method:', (data.method || data.paymentMethod || 'cash').replace('_', ' ').toUpperCase()],
    ['Status:', data.status.toUpperCase()],
  ];

  autoTable(doc, {
    startY: 50,
    head: [],
    body: details,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Parties involved
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Parties', 20, finalY);

  const parties: string[][] = [];
  if (data.businessName || data.traderName) parties.push(['Merchant:', data.businessName || data.traderName || '']);
  if (data.tin || data.traderTin) parties.push(['TIN:', data.tin || data.traderTin || '']);
  if (data.traderPhone) parties.push(['Merchant phone:', data.traderPhone]);
  if (data.traderAddress) parties.push(['Merchant address:', data.traderAddress]);
  if (data.customerName) parties.push(['Customer:', data.customerName]);
  if (data.customerPhone) parties.push(['Customer phone:', data.customerPhone]);
  if (data.senderName) parties.push(['From:', data.senderName]);
  if (data.recipientName) parties.push(['To:', data.recipientName]);

  autoTable(doc, {
    startY: finalY + 5,
    head: [],
    body: parties,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
  });

  const finalY2 = (doc as any).lastAutoTable.finalY + 10;

  // Amount
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Amount:', 20, finalY2);
  doc.setTextColor(234, 88, 12);
  doc.text(`RWF ${formatCurrency(data.amount)}`, pageWidth - 20, finalY2, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Thank you for using Bwenge Wallet.', pageWidth / 2, pageWidth > 250 ? 280 : 270, {
    align: 'center',
  });
  doc.text(
    'This is a computer-generated receipt and does not require a signature.',
    pageWidth / 2,
    pageWidth > 250 ? 285 : 275,
    { align: 'center' }
  );

  if (options.save !== false) {
    doc.save(`Bwenge_Receipt_${data.transactionId}.pdf`);
  }

  return doc.output('blob');
};

export const generateAccountingReport = (
  title: string,
  headers: string[],
  body: any[][],
  traderName: string,
  options: {
    reportId?: string;
    statementType?: string;
    dateModified?: string;
    verificationPayload?: string;
    qrDataUrl?: string;
  } = {}
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedAt = new Date().toLocaleString();
  const reportId = options.reportId || `ACC-${Date.now().toString(36).toUpperCase()}`;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(234, 88, 12); // Orange-600
  doc.text('Bwenge WALLET', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(title.toUpperCase(), pageWidth / 2, 30, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Merchant: ${traderName}`, 20, 40);
  doc.text(`Generated on: ${generatedAt}`, 20, 45);
  doc.text(`Date modified: ${options.dateModified || generatedAt}`, 20, 50);
  doc.text(`Verification ID: ${reportId}`, 20, 55);

  if (options.qrDataUrl) {
    doc.addImage(options.qrDataUrl, 'PNG', pageWidth - 48, 36, 28, 28);
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text('Scan to verify', pageWidth - 34, 68, { align: 'center' });
  }

  // Table
  autoTable(doc, {
    startY: 72,
    head: [headers],
    body: body,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
  });

  const footerY = pageHeight - 18;
  doc.setDrawColor(230);
  doc.line(20, footerY - 6, pageWidth - 20, footerY - 6);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('This report is computer-generated by Bwenge Nexus.', pageWidth / 2, footerY, {
    align: 'center',
  });
  doc.text(`Report ID: ${reportId}`, pageWidth / 2, footerY + 5, { align: 'center' });

  doc.save(`Bwenge_${title.replace(/\s+/g, '_')}_${reportId}.pdf`);
};
