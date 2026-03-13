// Document types and utilities

export interface DocumentType {
  value: string;
  label: string;
  price: number;
}

export const DOCUMENT_TYPES: DocumentType[] = [
  { value: 'copy-of-grades', label: 'Copy of Grades', price: 100 },
  { value: 'form-137', label: 'Form 137', price: 150 },
  { value: 'diploma', label: 'Diploma', price: 200 },
  { value: 'certificate-enrollment', label: 'Certificate of Enrollment', price: 50 },
  { value: 'good-moral', label: 'Good Moral Character', price: 100 },
];

export interface PaymentMethod {
  value: string;
  label: string;
  description: string;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  { value: 'cash', label: 'Cash', description: "Pay at the Registrar's Office" },
  { value: 'online', label: 'Online Payment', description: 'Pay online via GCash, Maya, or other methods' },
];

// Document utility functions
export const documentUtils = {
  // Calculate total price for selected documents
  calculateTotal: (selectedDocuments: string[]): number => {
    return selectedDocuments.reduce((total, docValue) => {
      const doc = DOCUMENT_TYPES.find(d => d.value === docValue);
      return total + (doc?.price || 0);
    }, 0);
  },

  // Get document by value
  getDocumentByValue: (value: string): DocumentType | undefined => {
    return DOCUMENT_TYPES.find(d => d.value === value);
  },

  // Format price to Philippine Peso
  formatPrice: (price: number): string => {
    return `₱${price.toLocaleString()}.00`;
  },
};
