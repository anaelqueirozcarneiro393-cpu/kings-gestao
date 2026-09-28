import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('kings_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [deliveryType, setDeliveryType] = useState('delivery'); // 'delivery' or 'pickup'
  const [deliveryFee, setDeliveryFee] = useState(5.0);

  useEffect(() => {
    try {
      localStorage.setItem('kings_cart', JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [items]);

  const addToCart = (product, business, quantity = 1, selectedAddons = [], notes = '') => {
    const addonsTotal = selectedAddons.reduce((sum, add) => sum + (Number(add.price) || 0), 0);
    const unitPrice = (Number(product.price) || 0) + addonsTotal;
    const subtotal = unitPrice * quantity;

    const newItem = {
      cart_item_id: `${product.id}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      product_id: product.id,
      product_name: product.name,
      business_id: business.id,
      business_name: business.name,
      business_slug: business.slug,
      image_url: product.image_url,
      unit_price: unitPrice,
      base_price: product.price,
      quantity,
      subtotal,
      notes,
      addons: selectedAddons.map(a => ({
        addon_id: a.id,
        name: a.name,
        unit_price: Number(a.price) || 0
      }))
    };

    setItems(prev => [...prev, newItem]);
  };

  const removeFromCart = (cartItemId) => {
    setItems(prev => prev.filter(item => item.cart_item_id !== cartItemId));
  };

  const updateQuantity = (cartItemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setItems(prev => prev.map(item => {
      if (item.cart_item_id === cartItemId) {
        return {
          ...item,
          quantity: newQuantity,
          subtotal: item.unit_price * newQuantity
        };
      }
      return item;
    }));
  };

  const [coupon, setCoupon] = useState(null);

  const clearCart = () => {
    setItems([]);
    setCoupon(null);
  };

  const discount = coupon ? Number(coupon.discount) || 0 : 0;
  const cartSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = Math.max(0, cartSubtotal + (deliveryType === 'delivery' ? deliveryFee : 0) - discount);

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartSubtotal,
      cartItemCount,
      cartTotal,
      deliveryType,
      setDeliveryType,
      deliveryFee,
      setDeliveryFee,
      coupon,
      setCoupon,
      discount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
