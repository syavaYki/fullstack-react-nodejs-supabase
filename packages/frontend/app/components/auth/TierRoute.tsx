/**
 * TierRoute Component
 * Wraps routes that require specific membership tier
 * Shows upgrade prompt if tier is insufficient
 */

import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { useAuth } from '../../contexts/AuthContext';
import { membershipApi } from '../../api';
import { ProtectedRoute } from './ProtectedRoute';

interface TierRouteProps {
  children: ReactNode;
  allowedTiers: string[];
}

export function TierRoute({ children, allowedTiers }: TierRouteProps) {
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [currentTier, setCurrentTier] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const checkAccess = async () => {
      try {
        const response = await membershipApi.getFeatures();
        if (response.success && response.data) {
          const tierName = response.data.tier_name.toLowerCase();
          setCurrentTier(response.data.tier_display_name);
          setHasAccess(allowedTiers.map((t) => t.toLowerCase()).includes(tierName));
        }
      } catch (error) {
        console.error('Error checking tier access:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [isAuthenticated, allowedTiers]);

  // Wrap in ProtectedRoute to handle authentication
  return (
    <ProtectedRoute>
      {isLoading ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '50vh',
          }}
        >
          <CircularProgress />
        </Box>
      ) : hasAccess ? (
        <>{children}</>
      ) : (
        <Container maxWidth="sm" sx={{ py: 8 }}>
          <Card>
            <CardContent sx={{ p: 6, textAlign: 'center' }}>
              <LockIcon color="primary" sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Upgrade Required
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                This content requires a <strong>{allowedTiers.join(' or ')}</strong> subscription.
              </Typography>
              {currentTier && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                  You are currently on the <strong>{currentTier}</strong> plan.
                </Typography>
              )}
              <Button component={Link} to="/pricing" variant="contained" size="large">
                View Pricing
              </Button>
            </CardContent>
          </Card>
        </Container>
      )}
    </ProtectedRoute>
  );
}

export default TierRoute;
