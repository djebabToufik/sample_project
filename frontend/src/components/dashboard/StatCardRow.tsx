import { Grid } from '@mui/material';

import StatCard, { type StatCardProps } from './StatCard';

// A row of summary cards: four per row on wide screens, one per row on phones.
export default function StatCardRow({ cards }: { cards: StatCardProps[] }) {
  return (
    <Grid container spacing={4} sx={{ mb: 2 }}>
      {cards.map((card) => (
        <Grid key={card.title} size={{ xs: 12, md: 3 }}>
          <StatCard {...card} />
        </Grid>
      ))}
    </Grid>
  );
}
