import CategoryIcon from '@mui/icons-material/Category';

import DataTable, { type Column } from '../../components/DataTable';
import ListPage from '../../components/ListPage';
import { queryKeys, useDeleteMany, useProducts, useRefresh } from '../../data/queries';
import type { Product } from '../../data/types';
import ProductEditForm from './ProductForm/ProductEditForm';
import ProductsModal from './ProductForm/ProductModal';

const columns: Column<Product>[] = [
  { id: 'product_name', label: 'Product name' },
  { id: 'ideal_cycle', label: 'Ideal cycle (s)' },
];

export default function ProductsPage() {
  const products = useProducts();
  const refresh = useRefresh(queryKeys.products);
  const remove = useDeleteMany({
    path: '/api/products/',
    label: 'Products',
    invalidate: [queryKeys.products],
  });

  return (
    <ListPage icon={<CategoryIcon />} title="Products table" loading={products.isPending || remove.isPending}>
      <DataTable
        title="Products"
        rows={products.data ?? []}
        columns={columns}
        onDelete={remove.mutateAsync}
        onUpdate={refresh}
        renderView={({ open, row, onClose }) => <ProductsModal open={open} product={row} onClose={onClose} />}
        renderForm={({ open, row, onClose, onSaved }) => (
          <ProductEditForm open={open} product={row} onClose={onClose} onSaved={onSaved} />
        )}
      />
    </ListPage>
  );
}
