function parsePositiveQuantity(value) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const normalized = Math.round(quantity * 1000) / 1000;
  return normalized > 0 ? normalized : null;
}

function normalizeInventoryQuantities(body) {
  const quantity = body.is_folder ? 0 : Number(body.quantity ?? 0);
  const openedQuantity = body.is_folder || body.opened_quantity_remaining === '' || body.opened_quantity_remaining == null
    ? null
    : Number(body.opened_quantity_remaining);

  if (!Number.isFinite(quantity) || quantity < 0) {
    return { error: 'Quantity must be a non-negative number.' };
  }
  if (openedQuantity != null && (!Number.isFinite(openedQuantity) || openedQuantity < 0)) {
    return { error: 'Opened package amount must be a non-negative number.' };
  }
  const normalizedQuantity = Math.round(quantity * 1000) / 1000;
  const normalizedOpenedQuantity = openedQuantity == null ? null : Math.round(openedQuantity * 1000) / 1000;
  if (normalizedOpenedQuantity != null && normalizedOpenedQuantity > normalizedQuantity) {
    return { error: 'Amount remaining in the opened package cannot exceed the total quantity on hand.' };
  }

  return {
    quantity: normalizedQuantity,
    opened_quantity_remaining: normalizedOpenedQuantity,
  };
}

module.exports = { normalizeInventoryQuantities, parsePositiveQuantity };
