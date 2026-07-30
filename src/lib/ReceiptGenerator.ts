import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReceiptData {
  transactionId: string;
  date: string;
  customerName: string;
  customerContact?: string;
  traderName: string;
  traderTin: string;
  traderAppNumber: string;
  traderAddress?: string;
  traderContact?: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  totalAmount: number;
  paymentMethod: string;
}

export const generateReceipt = (data: ReceiptData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a6', // Compact receipt size
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  // Header
  doc.setFontSize(18);
  doc.setTextColor(234, 88, 12); // Orange-600
  doc.text('Bwenge WALLET', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Official Sales Receipt', pageWidth / 2, 22, { align: 'center' });

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, 26, pageWidth - margin, 26);

  // Transaction Info
  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text(`Receipt #: ${data.transactionId}`, margin, 32);
  doc.text(`Date: ${data.date}`, margin, 36);
  doc.text(`Payment: ${(data.paymentMethod || 'N/A').toUpperCase()}`, margin, 40);

  // Trader Info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('TRADER:', margin, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(data.traderName, margin + 15, 48);
  doc.text(`Address: ${data.traderAddress || 'Not provided'}`, margin, 53);
  doc.text(`Contact: ${data.traderContact || 'Not provided'}`, margin, 58);
  if (data.traderTin) doc.text(`TIN: ${data.traderTin}`, margin, 63);

  // Customer Info
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER:', margin, 70);
  doc.setFont('helvetica', 'normal');
  doc.text(data.customerName || 'Walk-in customer', margin + 20, 70);
  if (data.customerContact) {
    doc.text(`Contact: ${data.customerContact}`, margin, 75);
  }

  // Table
  autoTable(doc, {
    startY: 82,
    head: [['Item', 'Qty', 'Price', 'Total']],
    body: [
      [
        data.productCode ? `${data.productName}\n(${data.productCode})` : data.productName,
        data.quantity.toString(),
        `RWF ${(data.unitPrice || data.totalAmount / data.quantity).toLocaleString()}`,
        `RWF ${(data.unitPrice * data.quantity).toLocaleString()}`,
      ],
    ],
    theme: 'striped',
    headStyles: { fillColor: [234, 88, 12] }, // Orange-600
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: margin, right: margin },
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  const subtotal = data.unitPrice * data.quantity;
  const discount = Math.max(0, data.discountAmount || 0);

  doc.setFontSize(8);
  doc.text('Subtotal:', pageWidth - margin - 35, finalY);
  doc.text(`RWF ${subtotal.toLocaleString()}`, pageWidth - margin, finalY, { align: 'right' });

  if (discount > 0) {
    doc.text('Discount:', pageWidth - margin - 35, finalY + 5);
    doc.text(`- RWF ${discount.toLocaleString()}`, pageWidth - margin, finalY + 5, {
      align: 'right',
    });
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const totalY = discount > 0 ? finalY + 13 : finalY + 8;
  doc.text('TOTAL PAID:', pageWidth - margin - 35, totalY);
  doc.text(`RWF ${data.totalAmount.toLocaleString()}`, pageWidth - margin, totalY, {
    align: 'right',
  });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Payment method: ${(data.paymentMethod || 'manual').toUpperCase()}`, margin, totalY + 8);

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150);
  doc.text('Thank you for using Bwenge Wallet!', pageWidth / 2, pageWidth * 1.4 - 5, {
    align: 'center',
  });
  doc.text('Verified Digital Transaction', pageWidth / 2, pageWidth * 1.4, { align: 'center' });

  // Save the PDF
  doc.save(`Bwenge_Receipt_${data.transactionId}.pdf`);
};

// Compatibility wrapper for TraderPurchases.tsx
export const generateReceiptPDF = (data: any) => {
  generateReceipt({
    transactionId: data.id,
    date: data.timestamp
      ? new Date(data.timestamp.seconds * 1000).toLocaleString()
      : new Date().toLocaleString(),
    customerName: data.customerName,
    customerContact: data.customerPhone || data.customerEmail || '',
    traderName: data.traderName,
    traderTin: data.traderTin,
    traderAppNumber: '',
    traderAddress: data.traderAddress,
    traderContact: data.traderPhone || data.traderEmail || '',
    productName: data.productName,
    productCode: '',
    quantity: data.quantity,
    unitPrice: data.amount / data.quantity,
    discountAmount: data.discountAmount || 0,
    totalAmount: data.amount,
    paymentMethod: data.paymentMethod,
  });
};
