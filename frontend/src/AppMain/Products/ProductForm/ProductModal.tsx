import ViewDrawer, { InfoRow, InfoSection } from '../../../components/form/ViewDrawer';
import type { Product } from '../../../data/types';

interface ProductModalProps {
  open: boolean;
  product: Product | null | undefined;
  onClose: () => void;
}

export default function ProductModal({ open, product, onClose }: ProductModalProps) {
  if (!product) return null;
  return (
    <ViewDrawer open={open} title="View Product" onClose={onClose}>
      <InfoSection title="Basic Information">
        <InfoRow label="Product Name" value={product.product_name} />
        <InfoRow label="Product ID" value={product.product_id} />
        <InfoRow label="Ideal Cycle (seconds)" value={product.ideal_cycle} />
      </InfoSection>
    </ViewDrawer>
  );
}
