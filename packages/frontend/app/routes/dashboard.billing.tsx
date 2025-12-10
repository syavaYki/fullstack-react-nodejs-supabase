import type { Route } from './+types/dashboard.billing';
import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid2 as Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Skeleton,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Link } from 'react-router';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import * as billingApi from '~/api/billing.api';
import * as membershipApi from '~/api/membership.api';
import type { PaymentHistory, Membership, MembershipTier } from '~/types';
import {
  formatPrice,
  formatDate,
  capitalize,
  getPaymentStatusColor,
  getPaymentStatusLabel,
} from '~/utils';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Billing - SaaS Boilerplate' }];
}

export default function BillingPage() {
  const [membership, setMembership] = useState<(Membership & { tier: MembershipTier }) | null>(
    null
  );
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        const [membershipRes, paymentsRes] = await Promise.all([
          membershipApi.getMembership(),
          billingApi.getPaymentHistory(10),
        ]);

        if (membershipRes.success && membershipRes.data) {
          setMembership(membershipRes.data);
        }
        if (paymentsRes.success && paymentsRes.data) {
          setPayments(paymentsRes.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load billing data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleManageSubscription = async () => {
    setIsRedirecting(true);
    setError(null);

    try {
      await billingApi.redirectToPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
      setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={150} height={40} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={350} height={24} sx={{ mb: 4 }} />
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
          </Grid>
          <Grid size={12}>
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1 }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  const hasPaidSubscription = membership?.stripe_subscription_id;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Billing
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage your subscription and payment methods
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={4}>
        {/* Current Subscription */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <CreditCardIcon color="primary" />
                <Typography variant="h6">Current Subscription</Typography>
              </Box>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Plan</Typography>
                  <Typography fontWeight={500}>
                    {membership?.tier?.display_name || 'Free'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Billing Cycle</Typography>
                  <Typography>
                    {membership?.billing_cycle ? capitalize(membership.billing_cycle) : 'N/A'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Amount</Typography>
                  <Typography>
                    {membership?.tier
                      ? membership.billing_cycle === 'yearly'
                        ? `${formatPrice((membership.tier.price_yearly || 0) * 100, 'usd')}/year`
                        : `${formatPrice((membership.tier.price_monthly || 0) * 100, 'usd')}/month`
                      : 'Free'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Next Billing Date</Typography>
                  <Typography>
                    {membership?.next_billing_date
                      ? formatDate(membership.next_billing_date)
                      : 'N/A'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Status</Typography>
                  <Chip
                    label={membership?.status ? capitalize(membership.status) : 'Active'}
                    color={
                      membership?.status === 'active'
                        ? 'success'
                        : membership?.status === 'trial'
                          ? 'warning'
                          : membership?.status === 'cancelled'
                            ? 'error'
                            : 'default'
                    }
                    size="small"
                  />
                </Box>
              </Stack>
              {hasPaidSubscription ? (
                <Button
                  variant="outlined"
                  fullWidth
                  sx={{ mt: 3 }}
                  onClick={handleManageSubscription}
                  disabled={isRedirecting}
                  startIcon={
                    isRedirecting ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <OpenInNewIcon />
                    )
                  }
                >
                  {isRedirecting ? 'Redirecting...' : 'Manage Subscription'}
                </Button>
              ) : (
                <Button component={Link} to="/pricing" variant="contained" fullWidth sx={{ mt: 3 }}>
                  Upgrade Plan
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Payment Method */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <CreditCardIcon color="primary" />
                <Typography variant="h6">Payment Method</Typography>
              </Box>
              {hasPaidSubscription ? (
                <>
                  <Box
                    sx={{
                      p: 3,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: 'grey.50',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Payment method is managed through Stripe.
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{ mt: 3 }}
                    onClick={handleManageSubscription}
                    disabled={isRedirecting}
                    startIcon={
                      isRedirecting ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        <OpenInNewIcon />
                      )
                    }
                  >
                    {isRedirecting ? 'Redirecting...' : 'Update Payment Method'}
                  </Button>
                </>
              ) : (
                <Box
                  sx={{
                    p: 3,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    No payment method on file. Upgrade to a paid plan to add a payment method.
                  </Typography>
                  <Button component={Link} to="/pricing" variant="contained" sx={{ mt: 2 }}>
                    View Plans
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Payment History */}
        <Grid size={12}>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <ReceiptIcon color="primary" />
                <Typography variant="h6">Payment History</Typography>
              </Box>
              {payments.length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {payment.stripe_invoice_id
                              ? `INV-${payment.stripe_invoice_id.slice(-8).toUpperCase()}`
                              : `PAY-${payment.id.slice(-8).toUpperCase()}`}
                          </TableCell>
                          <TableCell>{formatDate(payment.paid_at || payment.created_at)}</TableCell>
                          <TableCell>{formatPrice(payment.amount, payment.currency)}</TableCell>
                          <TableCell>
                            <Chip
                              label={getPaymentStatusLabel(payment.status)}
                              color={getPaymentStatusColor(payment.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            {payment.invoice_pdf && (
                              <Button
                                size="small"
                                href={payment.invoice_pdf}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Download
                              </Button>
                            )}
                            {payment.receipt_url && !payment.invoice_pdf && (
                              <Button
                                size="small"
                                href={payment.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Receipt
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No payment history available.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
