import FormDrawer, { FormSection } from '../../../components/form/FormDrawer';
import { TextInput } from '../../../components/form/fields';
import { requireFields, useForm, type FormErrors } from '../../../components/form/useForm';
import { useOpenCount } from '../../../components/form/useOpenCount';
import { useSaveItem } from '../../../data/queries';
import type { Product } from '../../../data/types';

interface ProductFormProps {
  open: boolean;
  product?: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

interface Values {
  product_name: string;
  product_id: string;
  ideal_cycle: string;
}

function validate(values: Values): FormErrors<Values> {
  const errors = requireFields(values, ['product_name', 'product_id', 'ideal_cycle']);
  if (!errors.ideal_cycle && !(Number(values.ideal_cycle) > 0)) errors.ideal_cycle = 'Must be more than 0';
  return errors;
}

export default function ProductEditForm(props: ProductFormProps) {
  return <ProductFormBody key={useOpenCount(props.open)} {...props} />;
}

function ProductFormBody({ open, product, onClose, onSaved }: ProductFormProps) {
  const { values, set, errors, submit } = useForm<Values>(
    {
      product_name: product?.product_name ?? '',
      product_id: product?.product_id ?? '',
      ideal_cycle: product?.ideal_cycle ? String(product.ideal_cycle) : '',
    },
    validate,
  );
  // Products are created and changed through the products-read endpoint.
  const save = useSaveItem('/api/products/', 'Product');

  return (
    <FormDrawer
      open={open}
      title={product ? 'Edit Product' : 'New Product'}
      submitLabel={product ? 'Save' : 'Create'}
      busy={save.isPending}
      onClose={onClose}
      onSubmit={() =>
        submit((v) => save.mutate({ uuid: product?.uuid, values: { ...v } }, { onSuccess: onSaved }))
      }
    >
      <FormSection title="Basic Information">
        <TextInput
          label="Product Name"
          value={values.product_name}
          onChange={set('product_name')}
          error={errors.product_name}
          required
        />
        <TextInput
          label="Product ID"
          value={values.product_id}
          onChange={set('product_id')}
          error={errors.product_id}
          required
        />
        <TextInput
          label="Ideal Cycle (seconds)"
          type="number"
          value={values.ideal_cycle}
          onChange={set('ideal_cycle')}
          error={errors.ideal_cycle}
          required
        />
      </FormSection>
    </FormDrawer>
  );
}
