// Formatting utilities

export const formatUtils = {
  // Format date to locale string
  formatDate: (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  },

  // Format date to ISO string
  formatDateISO: (date: Date): string => {
    return date.toISOString().split('T')[0];
  },

  // Format phone number
  formatPhone: (phone: string): string => {
    // Remove non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Format as Philippine phone number
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    
    return phone;
  },

  // Format name (capitalize first letter)
  formatName: (name: string): string => {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  },

  // Format full name
  formatFullName: (firstName: string, lastName: string, middleName?: string | null): string => {
    const parts = [firstName, middleName, lastName].filter(Boolean);
    return parts.join(' ');
  },

  // Format currency to Philippine Peso
  formatCurrency: (amount: number): string => {
    return `₱${amount.toLocaleString()}.00`;
  },
};
