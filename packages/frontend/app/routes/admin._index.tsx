import type { Route } from './+types/admin._index';
import {
  Box,
  Typography,
  Grid2 as Grid,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
} from '@mui/material';
import { Link } from 'react-router';
import PeopleIcon from '@mui/icons-material/People';
import LayersIcon from '@mui/icons-material/Layers';
import ExtensionIcon from '@mui/icons-material/Extension';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Admin Dashboard - SaaS Boilerplate' }];
}

export async function loader({ request: _request }: Route.LoaderArgs) {
  // TODO: Fetch admin stats from backend
  return {
    stats: {
      totalUsers: 1234,
      activeSubscriptions: 567,
      totalTiers: 4,
      totalFeatures: 12,
    },
    recentSignups: [
      { id: '1', email: 'user1@example.com', created_at: '2024-01-15', tier: 'Premium' },
      { id: '2', email: 'user2@example.com', created_at: '2024-01-14', tier: 'Free' },
      { id: '3', email: 'user3@example.com', created_at: '2024-01-13', tier: 'Pro' },
    ],
  };
}

export default function AdminDashboardPage({ loaderData }: Route.ComponentProps) {
  const { stats, recentSignups } = loaderData;

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: <PeopleIcon />, color: 'primary.main' },
    {
      label: 'Active Subscriptions',
      value: stats.activeSubscriptions,
      icon: <TrendingUpIcon />,
      color: 'success.main',
    },
    {
      label: 'Membership Tiers',
      value: stats.totalTiers,
      icon: <LayersIcon />,
      color: 'info.main',
    },
    {
      label: 'Features',
      value: stats.totalFeatures,
      icon: <ExtensionIcon />,
      color: 'warning.main',
    },
  ];

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Admin Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Overview of your application's key metrics and recent activity.
      </Typography>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={stat.label}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {stat.label}
                    </Typography>
                    <Typography variant="h4" sx={{ mt: 1 }}>
                      {stat.value.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      bgcolor: stat.color,
                      color: 'white',
                      p: 1,
                      borderRadius: 1,
                    }}
                  >
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={4}>
        {/* Recent Signups */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h6">Recent Signups</Typography>
                <Button component={Link} to="/admin/users" size="small">
                  View All
                </Button>
              </Box>
              <List>
                {recentSignups.map((user) => (
                  <ListItem key={user.id} divider>
                    <ListItemAvatar>
                      <Avatar>
                        <PersonAddIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={user.email}
                      secondary={new Date(user.created_at).toLocaleDateString()}
                    />
                    <Chip
                      label={user.tier}
                      size="small"
                      color={
                        user.tier === 'Pro'
                          ? 'primary'
                          : user.tier === 'Premium'
                            ? 'secondary'
                            : 'default'
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <Button
                    component={Link}
                    to="/admin/tiers"
                    variant="outlined"
                    fullWidth
                    startIcon={<LayersIcon />}
                  >
                    Manage Tiers
                  </Button>
                </Grid>
                <Grid size={6}>
                  <Button
                    component={Link}
                    to="/admin/features"
                    variant="outlined"
                    fullWidth
                    startIcon={<ExtensionIcon />}
                  >
                    Manage Features
                  </Button>
                </Grid>
                <Grid size={6}>
                  <Button
                    component={Link}
                    to="/admin/users"
                    variant="outlined"
                    fullWidth
                    startIcon={<PeopleIcon />}
                  >
                    View Users
                  </Button>
                </Grid>
                <Grid size={6}>
                  <Button variant="outlined" fullWidth startIcon={<TrendingUpIcon />} disabled>
                    Analytics
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
