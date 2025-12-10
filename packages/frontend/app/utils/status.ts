type MuiColor = 'success' | 'warning' | 'error' | 'info' | 'default';

/**
 * Map payment status to MUI color
 * @param status Payment status string
 * @returns MUI color name
 */
export function getPaymentStatusColor(status: string): MuiColor {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'error';
    case 'refunded':
    case 'partially_refunded':
      return 'info';
    default:
      return 'default';
  }
}

/**
 * Map payment status to user-friendly label
 * @param status Payment status string
 * @returns Display label
 */
export function getPaymentStatusLabel(status: string): string {
  switch (status) {
    case 'succeeded':
      return 'Paid';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    case 'refunded':
      return 'Refunded';
    case 'partially_refunded':
      return 'Partial Refund';
    default:
      return status;
  }
}
