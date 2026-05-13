import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutClientPage from '@/app/checkout/CheckoutClientPage';
import { useCheckoutManager } from '@/managers/checkoutManager';
import { fireEvent, render, screen, within } from '../test-utils.jsx';

vi.mock('@/managers/checkoutManager', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useCheckoutManager: vi.fn(),
  };
});

function buildCheckoutState(overrides = {}) {
  return {
    cartItems: [
      { _id: 'product-1', title: 'Lavender Candle', quantity: 2, price: 18 },
      { _id: 'product-2', title: 'Rose Soap', quantity: 1, price: 9 },
    ],
    totalPrice: 45,
    formData: {
      name: 'Petya Babukova',
      phone: '+359888123456',
      email: 'petya@example.com',
      city: 'Sofia',
      address: '',
      note: '',
      paymentMethods: ['cod'],
    },
    errors: {},
    isSubmitting: false,
    shipping: {
      shippingMethod: 'econt',
      econtOffice: 'Econt office 1',
      speedyOffice: '',
      boxNow: false,
    },
    setShippingMethod: vi.fn(),
    setEcontOffice: vi.fn(),
    setSpeedyOffice: vi.fn(),
    econtOffices: [{ id: '2', address: 'бул. Витоша 2' }, { id: '1', address: 'бул. Витоша 1' }],
    speedyOffices: [],
    officesLoading: false,
    isConfirmOpen: false,
    closeConfirm: vi.fn(),
    confirmOrder: vi.fn(),
    submitError: '',
    submitSuccess: '',
    handleChange: vi.fn(),
    handlePaymentChange: vi.fn(),
    handleSubmit: vi.fn((event) => event.preventDefault()),
    ...overrides,
  };
}

describe('CheckoutClientPage', () => {
  beforeEach(() => {
    useCheckoutManager.mockReturnValue(buildCheckoutState());
  });

  it('renders an empty checkout state with a product-list link', () => {
    useCheckoutManager.mockReturnValue(buildCheckoutState({ cartItems: [], totalPrice: 0 }));

    render(<CheckoutClientPage />);

    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/products');
  });

  it('renders cart summary and sorted Econt offices', () => {
    const state = buildCheckoutState();
    useCheckoutManager.mockReturnValue(state);

    const { container } = render(<CheckoutClientPage />);
    const econtSelect = container.querySelector('#econtOffice');

    expect(screen.getByText('Lavender Candle')).toBeInTheDocument();
    expect(screen.getByText('Rose Soap')).toBeInTheDocument();
    expect(screen.getByText('45.00 €')).toBeInTheDocument();
    expect(Array.from(econtSelect.options).map((option) => option.value)).toEqual([
      '',
      'бул. Витоша 1',
      'бул. Витоша 2',
    ]);

    fireEvent.change(econtSelect, { target: { value: 'бул. Витоша 2' } });

    expect(state.setEcontOffice).toHaveBeenCalledWith('бул. Витоша 2');
  });

  it('switches delivery and payment callbacks through the rendered controls', () => {
    const state = buildCheckoutState();
    useCheckoutManager.mockReturnValue(state);

    const { container } = render(<CheckoutClientPage />);
    const shippingOptions = container.querySelectorAll('input[name="shippingMethod"]');
    const paymentOptions = container.querySelectorAll('input[type="checkbox"]');

    fireEvent.click(shippingOptions[1]);
    fireEvent.click(shippingOptions[2]);
    fireEvent.click(paymentOptions[0]);

    expect(state.setShippingMethod).toHaveBeenCalledWith('speedy');
    expect(state.setShippingMethod).toHaveBeenCalledWith('boxnow');
    expect(state.handlePaymentChange).toHaveBeenCalledWith('card');
  });

  it('shows Box Now address field and hides cash-on-delivery option', () => {
    useCheckoutManager.mockReturnValue(
      buildCheckoutState({
        shipping: { shippingMethod: 'boxnow', econtOffice: '', speedyOffice: '', boxNow: true },
        formData: {
          ...buildCheckoutState().formData,
          address: 'Locker address',
          paymentMethods: ['card'],
        },
      })
    );

    const { container } = render(<CheckoutClientPage />);

    expect(container.querySelector('#address')).toHaveValue('Locker address');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
  });

  it('renders confirmation modal actions and calls manager callbacks', () => {
    const state = buildCheckoutState({
      isConfirmOpen: true,
      formData: {
        ...buildCheckoutState().formData,
        note: 'Please call first',
      },
    });
    useCheckoutManager.mockReturnValue(state);

    render(<CheckoutClientPage />);

    const dialog = screen.getByRole('dialog');
    const buttons = screen.getAllByRole('button');

    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Petya Babukova')).toBeInTheDocument();
    expect(within(dialog).getByText('Please call first')).toBeInTheDocument();

    fireEvent.click(buttons[buttons.length - 2]);
    fireEvent.click(buttons[buttons.length - 1]);

    expect(state.closeConfirm).toHaveBeenCalled();
    expect(state.confirmOrder).toHaveBeenCalled();
  });
});
