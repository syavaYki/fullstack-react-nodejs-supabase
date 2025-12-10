import type { Route } from './+types/dashboard.usage';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid2 as Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Usage - SaaS Boilerplate' }];
}

const usageData = [
  {
    feature: 'API Calls',
    current: 1234,
    limit: 10000,
    period: 'Monthly',
    resetsAt: 'Jan 1, 2025',
  },
  {
    feature: 'Storage',
    current: 2500,
    limit: 10240,
    period: 'Lifetime',
    resetsAt: '-',
    unit: 'MB',
  },
  {
    feature: 'Team Members',
    current: 3,
    limit: 5,
    period: 'Lifetime',
    resetsAt: '-',
  },
  {
    feature: 'AI Assistant Queries',
    current: 45,
    limit: 100,
    period: 'Daily',
    resetsAt: 'Tomorrow',
  },
];

export default function UsagePage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Usage
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Track your feature usage and limits
      </Typography>

      {/* Usage Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {usageData.map((item) => {
          const percentage = (item.current / item.limit) * 100;
          const isExceeded = percentage >= 100;
          const isWarning = percentage >= 80;

          return (
            <Grid size={{ xs: 12, sm: 6 }} key={item.feature}>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 2,
                    }}
                  >
                    <Typography variant="h6">{item.feature}</Typography>
                    <Chip label={item.period} size="small" variant="outlined" />
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {item.current.toLocaleString()} / {item.limit.toLocaleString()}{' '}
                        {item.unit || ''}
                      </Typography>
                      <Typography
                        variant="body2"
                        color={isExceeded ? 'error' : isWarning ? 'warning.main' : 'text.secondary'}
                      >
                        {percentage.toFixed(0)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(percentage, 100)}
                      color={isExceeded ? 'error' : isWarning ? 'warning' : 'primary'}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Resets: {item.resetsAt}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Usage History Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Usage History
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Feature</TableCell>
                  <TableCell align="right">Current Usage</TableCell>
                  <TableCell align="right">Limit</TableCell>
                  <TableCell align="right">Period</TableCell>
                  <TableCell align="right">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usageData.map((row) => {
                  const percentage = (row.current / row.limit) * 100;
                  const isExceeded = percentage >= 100;
                  const isWarning = percentage >= 80;

                  return (
                    <TableRow key={row.feature}>
                      <TableCell>{row.feature}</TableCell>
                      <TableCell align="right">{row.current.toLocaleString()}</TableCell>
                      <TableCell align="right">{row.limit.toLocaleString()}</TableCell>
                      <TableCell align="right">{row.period}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={isExceeded ? 'Exceeded' : isWarning ? 'Warning' : 'OK'}
                          size="small"
                          color={isExceeded ? 'error' : isWarning ? 'warning' : 'success'}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
