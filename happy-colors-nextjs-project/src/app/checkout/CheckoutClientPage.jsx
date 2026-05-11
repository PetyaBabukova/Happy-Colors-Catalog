'use client';

import Link from 'next/link';
import styles from './checkout.module.css';
import MessageBox from '@/components/ui/MessageBox';
import {
  useCheckoutManager,
  ECONT_OFFICES,
  SPEEDY_OFFICES,
} from '@/managers/checkoutManager';

function normalizeSpaces(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function extractSortableStreetFromAddress(address = '') {
  const normalized = normalizeSpaces(address);

  if (!normalized) return '';

  const markerMatch = normalized.match(
    /\b(бул\.|булевард|ул\.|улица)\s+([^,]+)$/i
  );

  if (markerMatch?.[2]) {
    return normalizeSpaces(markerMatch[2])
      .replace(/\b(No|№)\s*\S+.*$/i, '')
      .replace(/\bвх\.\s*\S+.*$/i, '')
      .replace(/\bет\.\s*\S+.*$/i, '')
      .replace(/\bап\.\s*\S+.*$/i, '')
      .trim();
  }

  return normalized;
}

function getOfficeAddress(office) {
  if (!office) return '';
  if (typeof office === 'string') return normalizeSpaces(office);

  return normalizeSpaces(office.address || '');
}

function compareOfficesByAddress(a, b) {
  const addressA = getOfficeAddress(a);
  const addressB = getOfficeAddress(b);

  const streetA = extractSortableStreetFromAddress(addressA);
  const streetB = extractSortableStreetFromAddress(addressB);

  const numA = streetA.match(/^\d+/);
  const numB = streetB.match(/^\d+/);

  if (numA && numB) {
    const aNum = Number(numA[0]);
    const bNum = Number(numB[0]);

    if (aNum !== bNum) {
      return aNum - bNum;
    }
  } else if (numA && !numB) {
    return -1;
  } else if (!numA && numB) {
    return 1;
  }

  const byStreet = streetA.localeCompare(streetB, 'bg', {
    sensitivity: 'base',
    numeric: true,
  });

  if (byStreet !== 0) {
    return byStreet;
  }

  return addressA.localeCompare(addressB, 'bg', {
    sensitivity: 'base',
    numeric: true,
  });
}

function getOfficeOptionLabel(office, lockerPrefix) {
  const address = getOfficeAddress(office);

  if (!address) return '';

  if (typeof office === 'object' && office?.isAps) {
    return `${lockerPrefix} | ${address}`;
  }

  return address;
}

function getOfficeOptionValue(office) {
  return getOfficeAddress(office);
}

function getOfficeOptionKey(office, idx) {
  if (typeof office === 'object' && office?.id != null) {
    return String(office.id);
  }

  return `${getOfficeAddress(office)}-${idx}`;
}

export default function CheckoutClientPage() {
  const {
    cartItems,
    totalPrice,
    formData,
    errors,
    isSubmitting,
    shipping,
    setShippingMethod,
    setEcontOffice,
    setSpeedyOffice,
    econtOffices,
    speedyOffices,
    officesLoading,
    isConfirmOpen,
    closeConfirm,
    confirmOrder,
    submitError,
    submitSuccess,
    handleChange,
    handlePaymentChange,
    handleSubmit,
  } = useCheckoutManager();

  if (cartItems.length === 0) {
    return (
      <section className={styles.emptyCheckout} data-testid="empty-checkout">
        <h1>Количката е празна</h1>
        <p>Няма артикули за поръчка.</p>
        <Link href="/products" className={styles.backToShop}>
          ← Обратно към магазина
        </Link>
      </section>
    );
  }

  const cityFilled = formData.city?.trim().length > 0;
  const shouldShowAddressField = shipping.shippingMethod === 'boxnow';
  const isBoxNow = shipping.shippingMethod === 'boxnow';

  const paymentLabel =
    formData.paymentMethods?.[0] === 'card'
      ? 'С банкова карта'
      : formData.paymentMethods?.[0] === 'cod'
      ? 'Наложен платеж'
      : '-';

  const shippingLabel =
    shipping.shippingMethod === 'econt'
      ? `Еконт – ${shipping.econtOffice || '(не е избран офис)'}`
      : shipping.shippingMethod === 'speedy'
      ? `Спиди – ${shipping.speedyOffice || '(не е избран офис)'}`
      : shipping.shippingMethod === 'boxnow'
      ? `Box Now – ${formData.address || '(не е въведен адрес)'}`
      : '-';

  const availableEcontOffices =
    econtOffices && econtOffices.length > 0
      ? econtOffices
      : cityFilled
      ? ECONT_OFFICES
      : [];

  const availableSpeedyOffices =
    speedyOffices && speedyOffices.length > 0
      ? speedyOffices
      : cityFilled
      ? SPEEDY_OFFICES
      : [];

  const sortedEcontOffices = [...availableEcontOffices].sort(
    compareOfficesByAddress
  );
  const sortedSpeedyOffices = [...availableSpeedyOffices].sort(
    compareOfficesByAddress
  );

  return (
    <section className={styles.checkoutContainer}>
      <h1 className={styles.heading}>Завършване на поръчката</h1>

      <div className={styles.columns}>
        <form className={styles.form} onSubmit={handleSubmit} data-testid="checkout-form">
          <h2 className={styles.subheading}>Данни за доставка</h2>

          {submitError && (
            <div style={{ marginBottom: '12px' }} data-testid="checkout-error">
              <MessageBox type="error" message={submitError} />
            </div>
          )}

          {submitSuccess && (
            <div style={{ marginBottom: '12px' }} data-testid="checkout-success">
              <MessageBox type="success" message={submitSuccess} />
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="name">
              Име и фамилия <span className={styles.requiredStar}>*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
            />
            {errors.name && <p className={styles.error} data-testid="checkout-error-name">{errors.name}</p>}
          </div>

          <div className={styles.field}>
            <label htmlFor="phone">
              Телефон <span className={styles.requiredStar}>*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="text"
              value={formData.phone}
              onChange={handleChange}
            />
            {errors.phone && <p className={styles.error} data-testid="checkout-error-phone">{errors.phone}</p>}
          </div>

          <div className={styles.field}>
            <label htmlFor="email">
              E-mail <span className={styles.requiredStar}>*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
            />
            {errors.email && <p className={styles.error} data-testid="checkout-error-email">{errors.email}</p>}
          </div>

          <div className={styles.field}>
            <label htmlFor="city">
              Град <span className={styles.requiredStar}>*</span>
            </label>
            <input
              id="city"
              name="city"
              type="text"
              value={formData.city}
              onChange={handleChange}
            />
            {errors.city && <p className={styles.error} data-testid="checkout-error-city">{errors.city}</p>}
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Начин на доставка <span className={styles.requiredStar}>*</span>
            </span>

            <div className={styles.radioGroup}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="shippingMethod"
                  checked={shipping.shippingMethod === 'econt'}
                  data-testid="shipping-econt"
                  onChange={() => setShippingMethod('econt')}
                />
                <span>Доставка до офис или автомат на Еконт</span>
              </label>

              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="shippingMethod"
                  checked={shipping.shippingMethod === 'speedy'}
                  data-testid="shipping-speedy"
                  onChange={() => setShippingMethod('speedy')}
                />
                <span>Доставка до офис или автомат на Спиди</span>
              </label>

              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="shippingMethod"
                  checked={shipping.shippingMethod === 'boxnow'}
                  data-testid="shipping-boxnow"
                  onChange={() => setShippingMethod('boxnow')}
                />
                <span>Доставка до автомат на Box Now</span>
              </label>
            </div>

            {errors.shippingMethod && (
              <p className={styles.error} data-testid="checkout-error-shippingMethod">{errors.shippingMethod}</p>
            )}
          </div>

          {shipping.shippingMethod === 'econt' && (
            <div className={styles.field}>
              <label htmlFor="econtOffice">
                Офис или автомат на Еконт{' '}
                <span className={styles.requiredStar}>*</span>
              </label>

              {cityFilled ? (
                availableEcontOffices.length > 0 ? (
                  <select
                    id="econtOffice"
                    value={shipping.econtOffice}
                    data-testid="econt-office"
                    onChange={(e) => setEcontOffice(e.target.value)}
                  >
                    <option value="">Изберете офис или автомат на Еконт</option>
                    {sortedEcontOffices.map((office, idx) => {
                      const label = getOfficeOptionLabel(office, '24/7 Еконтомат');
                      const value = getOfficeOptionValue(office);
                      const key = getOfficeOptionKey(office, idx);

                      return (
                        <option key={key} value={value}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <select id="econtOffice" disabled>
                    <option value="">Няма офиси за този град</option>
                  </select>
                )
              ) : (
                <select id="econtOffice" disabled>
                  <option value="">Първо въведете град</option>
                </select>
              )}

              {errors.econtOffice && (
                <p className={styles.error} data-testid="checkout-error-econtOffice">{errors.econtOffice}</p>
              )}

              {officesLoading && (
                <p style={{ marginTop: '4px', fontSize: '0.875em', color: '#666' }}>
                  Зареждат се офисите…
                </p>
              )}
            </div>
          )}

          {shipping.shippingMethod === 'speedy' && (
            <div className={styles.field}>
              <label htmlFor="speedyOffice">
                Офис или автомат на Спиди{' '}
                <span className={styles.requiredStar}>*</span>
              </label>

              {cityFilled ? (
                availableSpeedyOffices.length > 0 ? (
                  <select
                    id="speedyOffice"
                    value={shipping.speedyOffice}
                    data-testid="speedy-office"
                    onChange={(e) => setSpeedyOffice(e.target.value)}
                  >
                    <option value="">Изберете офис или автомат на Спиди</option>
                    {sortedSpeedyOffices.map((office, idx) => {
                      const label = getOfficeOptionLabel(office, '24/7 Автомат');
                      const value = getOfficeOptionValue(office);
                      const key = getOfficeOptionKey(office, idx);

                      return (
                        <option key={key} value={value}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <select id="speedyOffice" disabled>
                    <option value="">Няма офиси за този град</option>
                  </select>
                )
              ) : (
                <select id="speedyOffice" disabled>
                  <option value="">Първо въведете град</option>
                </select>
              )}

              {errors.speedyOffice && (
                <p className={styles.error} data-testid="checkout-error-speedyOffice">{errors.speedyOffice}</p>
              )}

              {officesLoading && (
                <p style={{ marginTop: '4px', fontSize: '0.875em', color: '#666' }}>
                  Зареждат се офисите…
                </p>
              )}
            </div>
          )}

          {shouldShowAddressField && (
            <div className={styles.field}>
              <label htmlFor="address">
                Адрес за доставка <span className={styles.requiredStar}>*</span>
              </label>
              <input
                id="address"
                name="address"
                type="text"
                value={formData.address}
                onChange={handleChange}
              />
              {errors.address && <p className={styles.error} data-testid="checkout-error-address">{errors.address}</p>}
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Начин на плащане <span className={styles.requiredStar}>*</span>
            </span>

            <div className={styles.paymentOptions}>
              <label className={styles.paymentOption}>
                <input
                  type="checkbox"
                  checked={formData.paymentMethods.includes('card')}
                  data-testid="payment-card"
                  onChange={() => handlePaymentChange('card')}
                />
                <span>С банкова карта</span>
              </label>

              {!isBoxNow && (
                <label className={styles.paymentOption}>
                  <input
                    type="checkbox"
                    checked={formData.paymentMethods.includes('cod')}
                    data-testid="payment-cod"
                    onChange={() => handlePaymentChange('cod')}
                  />
                  <span>Наложен платеж</span>
                </label>
              )}
            </div>

            {isBoxNow && (
              <p style={{ marginTop: '4px', fontSize: '0.875em', color: '#666' }}>
                За Box Now е позволено само плащане с банкова карта.
              </p>
            )}

            {errors.paymentMethods && (
              <p className={styles.error} data-testid="checkout-error-paymentMethods">{errors.paymentMethods}</p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="note">Бележка към поръчката (по избор)</label>
            <textarea
              id="note"
              name="note"
              rows={3}
              value={formData.note}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting}
            data-testid="checkout-submit"
          >
            {isSubmitting ? 'Изпращане...' : 'Продължи'}
          </button>

          <p className={styles.requiredNote}>
            Полетата, отбелязани със{' '}
            <span className={styles.requiredStar}>*</span>, са задължителни.
          </p>
        </form>

        <aside className={styles.summary}>
          <h2 className={styles.subheading}>Вашата поръчка</h2>

          <ul className={styles.itemsList}>
            {cartItems.map((item) => (
              <li key={item._id} className={styles.itemRow}>
                <div>
                  <p className={styles.itemTitle}>{item.title}</p>
                  <p className={styles.itemMeta}>
                    Количество: {item.quantity} × {item.price.toFixed(2)} €
                  </p>
                </div>

                <p className={styles.itemTotal}>
                  {(item.quantity * item.price).toFixed(2)} €
                </p>
              </li>
            ))}
          </ul>

          <div className={styles.totalRow}>
            <span>Общо:</span>
            <strong>{totalPrice.toFixed(2)} € </strong>
          </div>

          <Link href="/cart" className={styles.backToCart}>
            ← Върни се към количката
          </Link>
        </aside>
      </div>

      {isConfirmOpen && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-confirm-title"
          data-testid="checkout-confirm-dialog"
        >
          <div className={styles.modal}>
            <h2 id="checkout-confirm-title" className={styles.modalTitle}>
              Моля проверете данните за доставка
            </h2>

            <div className={styles.modalBody}>
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>Име:</span>
                <span className={styles.modalValue}>{formData.name}</span>
              </div>

              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>Телефон:</span>
                <span className={styles.modalValue}>{formData.phone}</span>
              </div>

              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>E-mail:</span>
                <span className={styles.modalValue}>{formData.email}</span>
              </div>

              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>Град:</span>
                <span className={styles.modalValue}>{formData.city}</span>
              </div>

              {shipping.shippingMethod === 'boxnow' && (
                <div className={styles.modalRow}>
                  <span className={styles.modalLabel}>Адрес:</span>
                  <span className={styles.modalValue}>{formData.address}</span>
                </div>
              )}

              {formData.note?.trim() ? (
                <div className={styles.modalRow}>
                  <span className={styles.modalLabel}>Бележка:</span>
                  <span className={styles.modalValue}>{formData.note}</span>
                </div>
              ) : null}

              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>Доставка:</span>
                <span className={styles.modalValue}>{shippingLabel}</span>
              </div>

              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>Плащане:</span>
                <span className={styles.modalValue}>{paymentLabel}</span>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalBtnSecondary}
                onClick={closeConfirm}
                disabled={isSubmitting}
              >
                Редактирай
              </button>

              <button
                type="button"
                className={styles.modalBtnPrimary}
                onClick={confirmOrder}
                disabled={isSubmitting}
                data-testid="confirm-order"
              >
                {isSubmitting ? 'Обработваме...' : 'Потвърждавам поръчката'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
