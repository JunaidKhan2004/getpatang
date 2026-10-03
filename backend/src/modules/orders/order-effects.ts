import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** Puts an order's items back into stock and takes them out of the sales count. */
export async function restockOrder(tx: Tx, items: { productId: string | null; variantId: string | null; quantity: number }[]) {
  for (const item of items) {
    if (item.variantId) {
      await tx.productVariant.updateMany({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
    } else if (item.productId) {
      await tx.product.updateMany({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
    }
    if (item.productId) {
      await tx.product.updateMany({ where: { id: item.productId }, data: { salesCount: { decrement: item.quantity } } });
    }
  }
}
