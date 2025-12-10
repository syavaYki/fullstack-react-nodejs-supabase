import type { Route } from './+types/admin.users';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Avatar,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  Stack,
} from '@mui/material';
import { useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'User Management - Admin' }];
}

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  tier_name: string;
  status: string;
  created_at: string;
  last_sign_in: string | null;
}

export async function loader({ request: _request }: Route.LoaderArgs) {
  // TODO: Fetch users from backend API with pagination
  return {
    users: [
      {
        id: '1',
        email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: null,
        tier_name: 'Pro',
        status: 'active',
        created_at: '2024-01-01',
        last_sign_in: '2024-01-15',
      },
      {
        id: '2',
        email: 'jane@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
        avatar_url: null,
        tier_name: 'Premium',
        status: 'active',
        created_at: '2024-01-05',
        last_sign_in: '2024-01-14',
      },
      {
        id: '3',
        email: 'bob@example.com',
        first_name: 'Bob',
        last_name: null,
        avatar_url: null,
        tier_name: 'Free',
        status: 'active',
        created_at: '2024-01-10',
        last_sign_in: '2024-01-13',
      },
      {
        id: '4',
        email: 'alice@example.com',
        first_name: 'Alice',
        last_name: 'Johnson',
        avatar_url: null,
        tier_name: 'Trial',
        status: 'trial',
        created_at: '2024-01-12',
        last_sign_in: '2024-01-15',
      },
      {
        id: '5',
        email: 'charlie@example.com',
        first_name: null,
        last_name: null,
        avatar_url: null,
        tier_name: 'Free',
        status: 'inactive',
        created_at: '2023-12-01',
        last_sign_in: null,
      },
    ] as User[],
    totalCount: 5,
  };
}

export default function AdminUsersPage({ loaderData }: Route.ComponentProps) {
  const { users, totalCount } = loaderData;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setDetailsOpen(true);
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'pro':
        return 'primary';
      case 'premium':
        return 'secondary';
      case 'trial':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'trial':
        return 'warning';
      case 'inactive':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatName = (user: User) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return '—';
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Users
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {totalCount} total users
          </Typography>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            placeholder="Search users by email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Tier</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell>Last Active</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar src={user.avatar_url || undefined}>
                        <PersonIcon />
                      </Avatar>
                      <Typography variant="subtitle2">{formatName(user)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.tier_name}
                      color={getTierColor(user.tier_name)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.status}
                      color={getStatusColor(user.status)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {user.last_sign_in ? new Date(user.last_sign_in).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleViewDetails(user)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>User Details</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ width: 64, height: 64 }} src={selectedUser.avatar_url || undefined}>
                  <PersonIcon sx={{ fontSize: 32 }} />
                </Avatar>
                <Box>
                  <Typography variant="h6">{formatName(selectedUser)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedUser.email}
                  </Typography>
                </Box>
              </Box>

              <Divider />

              <List dense disablePadding>
                <ListItem>
                  <ListItemText primary="User ID" secondary={selectedUser.id} />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Membership Tier"
                    secondary={
                      <Chip
                        label={selectedUser.tier_name}
                        color={getTierColor(selectedUser.tier_name)}
                        size="small"
                      />
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Status"
                    secondary={
                      <Chip
                        label={selectedUser.status}
                        color={getStatusColor(selectedUser.status)}
                        size="small"
                        variant="outlined"
                      />
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Joined"
                    secondary={new Date(selectedUser.created_at).toLocaleString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Last Sign In"
                    secondary={
                      selectedUser.last_sign_in
                        ? new Date(selectedUser.last_sign_in).toLocaleString()
                        : 'Never'
                    }
                  />
                </ListItem>
              </List>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          <Button variant="outlined">Edit User</Button>
          <Button variant="contained">Manage Membership</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
