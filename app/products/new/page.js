import ProductForm from '@/components/ProductForm';

export default async function NewProductPage({ searchParams }) {
  const { barcode = '' } = await searchParams;
  return <ProductForm initial={{ barcode }} />;
}
