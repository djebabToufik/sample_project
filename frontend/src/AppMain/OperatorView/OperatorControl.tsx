import {
  Backdrop,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  MenuItem,
  Select,
} from '@mui/material';

import { useAssets, useCells, useFaults, useProducts } from '../../data/queries';
import { useRememberedLine } from '../../data/rememberedLine';
import OperatorButtons from './OperatorButtons';

// Operator control panel: choose a line, see its state and report changes.
export default function OperatorControl() {
  const assets = useAssets();
  const cells = useCells();
  const faults = useFaults();
  const products = useProducts();
  const lines = assets.data ?? [];
  const [line, selectLine] = useRememberedLine(lines);
  const loading = assets.isPending || cells.isPending || faults.isPending || products.isPending;

  return (
    <div className="content-wrapper">
      <div className="container-fluid">
        <Backdrop sx={{ color: 'common.white', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading}>
          <CircularProgress />
        </Backdrop>
        <Grid container spacing={2} sx={{ mb: 3, mt: 2 }}>
          <Grid size={12} sx={{ display: 'flex', alignItems: 'end' }}>
            <Card sx={{ width: '100%' }} elevation={1}>
              <CardContent>
                <FormControl variant="standard" fullWidth sx={{ m: 1 }}>
                  <Select
                    value={line ?? ''}
                    onChange={(e) => selectLine(e.target.value)}
                    inputProps={{ 'aria-label': 'Line' }}
                  >
                    {lines.map((asset) => (
                      <MenuItem key={asset.uuid} value={asset.uuid}>
                        {asset.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        <OperatorButtons
          machine={line}
          cells={cells.data ?? []}
          faults={faults.data ?? []}
          products={products.data ?? []}
        />
      </div>
    </div>
  );
}
