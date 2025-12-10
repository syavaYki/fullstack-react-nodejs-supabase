import type { Route } from './+types/admin.features';
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
  Stack,
  MenuItem,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Feature Management - Admin' }];
}

type FeatureType = 'boolean' | 'limit' | 'enum';
type PeriodType = 'none' | 'daily' | 'monthly' | 'lifetime';

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string;
  feature_type: FeatureType;
  default_value: string;
  period_type: PeriodType;
  is_active: boolean;
}

export async function loader({ request: _request }: Route.LoaderArgs) {
  // TODO: Fetch features from backend API
  return {
    features: [
      {
        id: '1',
        key: 'api_calls',
        name: 'API Calls',
        description: 'Number of API calls allowed',
        feature_type: 'limit' as FeatureType,
        default_value: '100',
        period_type: 'monthly' as PeriodType,
        is_active: true,
      },
      {
        id: '2',
        key: 'storage_gb',
        name: 'Storage',
        description: 'Storage space in GB',
        feature_type: 'limit' as FeatureType,
        default_value: '1',
        period_type: 'none' as PeriodType,
        is_active: true,
      },
      {
        id: '3',
        key: 'team_members',
        name: 'Team Members',
        description: 'Number of team members',
        feature_type: 'limit' as FeatureType,
        default_value: '1',
        period_type: 'none' as PeriodType,
        is_active: true,
      },
      {
        id: '4',
        key: 'analytics_dashboard',
        name: 'Analytics Dashboard',
        description: 'Access to analytics',
        feature_type: 'boolean' as FeatureType,
        default_value: 'false',
        period_type: 'none' as PeriodType,
        is_active: true,
      },
      {
        id: '5',
        key: 'priority_support',
        name: 'Priority Support',
        description: 'Priority support access',
        feature_type: 'boolean' as FeatureType,
        default_value: 'false',
        period_type: 'none' as PeriodType,
        is_active: true,
      },
      {
        id: '6',
        key: 'export_format',
        name: 'Export Format',
        description: 'Available export formats',
        feature_type: 'enum' as FeatureType,
        default_value: 'csv',
        period_type: 'none' as PeriodType,
        is_active: true,
      },
    ],
  };
}

export default function AdminFeaturesPage({ loaderData }: Route.ComponentProps) {
  const { features } = loaderData;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);

  const handleOpenDialog = (feature?: Feature) => {
    setEditingFeature(feature || null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingFeature(null);
  };

  const getTypeColor = (type: FeatureType) => {
    switch (type) {
      case 'boolean':
        return 'info';
      case 'limit':
        return 'warning';
      case 'enum':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Features
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage feature flags and limits for different tiers.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Add Feature
        </Button>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Key</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Default Value</TableCell>
                <TableCell>Period</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {features.map((feature) => (
                <TableRow key={feature.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {feature.key}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2">{feature.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={feature.feature_type}
                      color={getTypeColor(feature.feature_type)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{feature.default_value}</TableCell>
                  <TableCell>
                    <Chip label={feature.period_type} variant="outlined" size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={feature.is_active ? 'Active' : 'Inactive'}
                      color={feature.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenDialog(feature)}>
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
        <DialogTitle>{editingFeature ? 'Edit Feature' : 'Add New Feature'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Key"
              fullWidth
              placeholder="e.g., api_calls"
              helperText="Unique identifier (lowercase, underscores)"
              defaultValue={editingFeature?.key || ''}
            />
            <TextField label="Name" fullWidth defaultValue={editingFeature?.name || ''} />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              defaultValue={editingFeature?.description || ''}
            />
            <TextField
              select
              label="Feature Type"
              fullWidth
              defaultValue={editingFeature?.feature_type || 'boolean'}
            >
              <MenuItem value="boolean">Boolean (true/false)</MenuItem>
              <MenuItem value="limit">Limit (numeric)</MenuItem>
              <MenuItem value="enum">Enum (options)</MenuItem>
            </TextField>
            <TextField
              label="Default Value"
              fullWidth
              defaultValue={editingFeature?.default_value || ''}
            />
            <TextField
              select
              label="Period Type"
              fullWidth
              defaultValue={editingFeature?.period_type || 'none'}
            >
              <MenuItem value="none">None (no reset)</MenuItem>
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="lifetime">Lifetime</MenuItem>
            </TextField>
            <FormControlLabel
              control={<Switch defaultChecked={editingFeature?.is_active ?? true} />}
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleCloseDialog}>
            {editingFeature ? 'Save Changes' : 'Create Feature'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
