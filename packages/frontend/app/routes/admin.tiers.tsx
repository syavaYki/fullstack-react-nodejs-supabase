import type { Route } from './+types/admin.tiers';
import {
  Box,
  Typography,
  Card,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Stack,
} from '@mui/material';
import { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Tier Management - Admin' }];
}

export async function loader({ request: _request }: Route.LoaderArgs) {
  // TODO: Fetch tiers from backend API
  return {
    tiers: [
      {
        id: '1',
        name: 'Free',
        description: 'Basic features for individuals',
        price_monthly: 0,
        price_yearly: 0,
        is_active: true,
        display_order: 1,
      },
      {
        id: '2',
        name: 'Premium',
        description: 'Advanced features for growing teams',
        price_monthly: 29,
        price_yearly: 290,
        is_active: true,
        display_order: 2,
      },
      {
        id: '3',
        name: 'Pro',
        description: 'Enterprise features with unlimited access',
        price_monthly: 79,
        price_yearly: 790,
        is_active: true,
        display_order: 3,
      },
      {
        id: '4',
        name: 'Trial',
        description: '14-day full access trial',
        price_monthly: 0,
        price_yearly: 0,
        is_active: true,
        display_order: 0,
      },
    ],
  };
}

export default function AdminTiersPage({ loaderData }: Route.ComponentProps) {
  const { tiers } = loaderData;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<(typeof tiers)[0] | null>(null);

  const handleOpenDialog = (tier?: (typeof tiers)[0]) => {
    setEditingTier(tier || null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTier(null);
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Membership Tiers
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage subscription tiers and pricing.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Add Tier
        </Button>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Monthly Price</TableCell>
                <TableCell align="right">Yearly Price</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tiers.map((tier) => (
                <TableRow key={tier.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{tier.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {tier.description}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {tier.price_monthly === 0 ? 'Free' : `$${tier.price_monthly}`}
                  </TableCell>
                  <TableCell align="right">
                    {tier.price_yearly === 0 ? 'Free' : `$${tier.price_yearly}`}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={tier.is_active ? 'Active' : 'Inactive'}
                      color={tier.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenDialog(tier)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTier ? 'Edit Tier' : 'Add New Tier'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField label="Name" fullWidth defaultValue={editingTier?.name || ''} />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              defaultValue={editingTier?.description || ''}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Monthly Price ($)"
                type="number"
                fullWidth
                defaultValue={editingTier?.price_monthly || 0}
              />
              <TextField
                label="Yearly Price ($)"
                type="number"
                fullWidth
                defaultValue={editingTier?.price_yearly || 0}
              />
            </Box>
            <TextField
              label="Display Order"
              type="number"
              fullWidth
              defaultValue={editingTier?.display_order || 0}
            />
            <FormControlLabel
              control={<Switch defaultChecked={editingTier?.is_active ?? true} />}
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleCloseDialog}>
            {editingTier ? 'Save Changes' : 'Create Tier'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
