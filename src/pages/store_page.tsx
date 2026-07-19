import { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { useLang } from '../i18n/LanguageContext';
import { listProducts, getCart, addToCart, removeFromCart, checkoutCart, type StoreProduct, type CartData } from '../api/store';
import { showToast } from '../components/common/Toast';
import { useAuth } from '../contexts/AuthContext';
import '../styles/practice_page.css'; // Resemble normal card styles
import '../styles/store_page.css';

export default function StorePage() {
    const { t } = useLang();
    const { user, updateUser } = useAuth();
    
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [cart, setCart] = useState<CartData>({ items: [], total_items: 0, total_cny: '0.00' });
    const [loading, setLoading] = useState(true);
    
    // UI states
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [actionId, setActionId] = useState<number | null>(null); // For loading state per product

    useEffect(() => {
        Promise.all([listProducts(), getCart()])
            .then(([prodRes, cartRes]) => {
                setProducts(prodRes.products);
                setCart(cartRes);
            })
            .catch(() => showToast(t('store.fetchFail'), 'error'))
            .finally(() => setLoading(false));
    }, [t]);

    const fetchCart = async () => {
        try {
            const res = await getCart();
            setCart(res);
        } catch (e) {
            console.error('Failed to fetch cart', e);
        }
    };

    const handleAddToCart = async (product: StoreProduct) => {
        if (!user) return;
        setActionId(product.id);
        try {
            await addToCart(product.id, 1);
            showToast(t('store.addSuccess'), 'success');
            await fetchCart();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } } };
            showToast(e.response?.data?.error || t('store.addFail'), 'error');
        } finally {
            setActionId(null);
        }
    };

    const handleUpdateQuantity = async (productId: number, delta: number) => {
        try {
            if (delta > 0) {
                await addToCart(productId, 1);
            } else {
                await removeFromCart(productId, 1, false);
            }
            await fetchCart();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } } };
            showToast(e.response?.data?.error || t('store.opFail'), 'error');
        }
    };

    const handleRemoveAll = async (productId: number) => {
        try {
            await removeFromCart(productId, 1, true);
            await fetchCart();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } } };
            showToast(e.response?.data?.error || t('store.deleteFail'), 'error');
        }
    };

    const handleCheckout = async () => {
        if (cart.items.length === 0) return;
        try {
            const res = await checkoutCart();
            showToast(res.message || t('store.checkoutSuccess'), 'success');
            if (res.new_balance !== undefined && user) {
                updateUser({ ...user, atBalance: res.new_balance });
            }
            setIsCartOpen(false);
            await fetchCart(); // Will be empty now
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } } };
            showToast(e.response?.data?.error || t('store.checkoutFail'), 'error');
        }
    };

    return (
        <Layout>
            <div className="store-page">
                <div className="store-header">
                    <h1>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                        {t('nav.store')}
                    </h1>

                    <div className="store-header-actions">
                        <div className="store-balance-badge">
                            <span>{t('store.balance')}</span>
                            <strong>{user?.atBalance || 0} AT</strong>
                        </div>

                        <button className="store-cart-trigger" onClick={() => setIsCartOpen(true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                            {t('store.cart')} ({cart.total_items})
                        </button>
                    </div>
                </div>
                
                {loading ? (
                    <div className="practice-loading">{t('store.loading')}</div>
                ) : (
                    <div className="store-product-grid">
                        {products.map(p => (
                            <article key={p.id} className="store-card" aria-label={p.name}>
                                <div className="store-card__content">
                                    <span className="store-card__badge">
                                        +{p.reward_amount}
                                    </span>

                                    <div className="store-card__image" aria-hidden="true">
                                        <span className="store-card__icon">💎</span>
                                    </div>

                                    <div className="store-card__text">
                                        <h3 className="store-card__title">{p.name}</h3>
                                        <p className="store-card__description">{p.description}</p>
                                    </div>

                                    <div className="store-card__footer">
                                        <span className="store-card__price">
                                        {p.price_currency === 'CNY' ? '¥' : 'AT'} {Number(p.price_amount).toString()}
                                        </span>

                                        <button
                                            className="store-card__button"
                                            onClick={() => handleAddToCart(p)}
                                            disabled={actionId !== null}
                                            title={actionId === p.id ? t('store.adding') : t('store.addToCart')}
                                            aria-label={actionId === p.id ? t('store.adding') : `${t('store.addToCart')}: ${p.name}`}
                                        >
                                            {actionId === p.id ? (
                                                <span className="store-card__button-loading">...</span>
                                            ) : (
                                                <svg
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.6"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    aria-hidden="true"
                                                >
                                                    <line x1="12" y1="5" x2="12" y2="19" />
                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            {/* Shopping Cart Modal */}
            {isCartOpen && (
                <div className="store-modal-overlay" onClick={() => setIsCartOpen(false)}>
                    <div className="store-cart-modal" onClick={e => e.stopPropagation()}>
                        
                        <div className="store-cart-header">
                            <h2 className="store-cart-title">{t('store.cartTitle')}</h2>
                            <button className="store-cart-close" onClick={() => setIsCartOpen(false)}>✕</button>
                        </div>

                        <div className="store-cart-body">
                            <div className="shop-name">{t('store.storeName')}</div>
                            <div className="info">{new Date().toLocaleDateString('zh-CN')} · {t('store.cartInfo').replace('{n}', String(cart.total_items))}</div>

                            {cart.items.length === 0 ? (
                                <div className="store-cart-empty">{t('store.cartEmpty')}</div>
                            ) : (
                                <>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>{t('store.colProduct')}</th>
                                                <th>{t('store.colQuantity')}</th>
                                                <th>{t('store.colPrice')}</th>
                                                <th>{t('store.colSubtotal')}</th>
                                                <th>{t('store.colAction')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cart.items.map(item => {
                                                const lineTotal = Number(item.price_amount) * item.quantity;
                                                return (
                                                    <tr key={`receipt-${item.cart_item_id}`}>
                                                        <td className="receipt-item-name">{item.name}</td>
                                                        <td>
                                                            <div className="receipt-qty-control">
                                                                <button
                                                                    className="receipt-qty-btn"
                                                                    onClick={() => handleUpdateQuantity(item.product_id, -1)}
                                                                    title={t('store.btnDecrease')}
                                                                >
                                                                    −
                                                                </button>
                                                                <span className="receipt-qty-value">{item.quantity}</span>
                                                                <button
                                                                    className="receipt-qty-btn"
                                                                    onClick={() => handleUpdateQuantity(item.product_id, 1)}
                                                                    title={t('store.btnIncrease')}
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td>{item.price_currency === 'CNY' ? `¥ ${item.price_amount}` : `AT ${item.price_amount}`}</td>
                                                        <td>{item.price_currency === 'CNY' ? `¥ ${lineTotal.toFixed(2)}` : `AT ${lineTotal.toString()}`}</td>
                                                        <td>
                                                            <button
                                                                className="receipt-delete-btn"
                                                                onClick={() => handleRemoveAll(item.product_id)}
                                                                title={t('store.btnRemoveItem')}
                                                            >
                                                                {t('store.btnDelete')}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    <div className="total">
                                        <span>{t('store.total')}</span>
                                        <span>¥ {cart.total_cny}</span>
                                    </div>

                                    <div className="thanks">{t('store.thanks')}</div>
                                </>
                            )}
                        </div>
                        
                        <div className="store-cart-footer">
                            <div>
                                <span className="store-cart-footer-total-label">{t('store.totalLabel')}</span>
                                <span className="store-cart-footer-total-value">¥ {cart.total_cny}</span>
                            </div>
                            <button
                                className="practice-btn"
                                style={{ margin: 0, minWidth: '150px' }}
                                onClick={handleCheckout}
                                disabled={cart.items.length === 0}
                            >
                                {user?.is_staff ? t('store.checkoutFree') : t('store.checkoutPay')}
                            </button>
                        </div>
                        
                    </div>
                </div>
            )}
        </Layout>
    );
}
