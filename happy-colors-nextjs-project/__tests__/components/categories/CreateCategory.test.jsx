import { beforeEach, describe, expect, it, vi } from 'vitest';
import CreateCategory from '@/components/categories/CreateCategory';
import { useProducts } from '@/context/ProductContext';
import { onCreateCategorySubmit } from '@/managers/categoriesManager';
import { fireEvent, render, waitFor } from '../test-utils.jsx';

vi.mock('@/context/ProductContext', () => ({
  useProducts: vi.fn(),
}));

vi.mock('@/managers/categoriesManager', () => ({
  onCreateCategorySubmit: vi.fn(),
}));

describe('CreateCategory', () => {
  const triggerCategoriesReload = vi.fn();

  beforeEach(() => {
    triggerCategoriesReload.mockClear();
    useProducts.mockReturnValue({ triggerCategoriesReload });
    onCreateCategorySubmit.mockImplementation((values, setSuccess, setError, setInvalidFields) => {
      setSuccess(true);
      setError('');
      setInvalidFields([]);
    });
  });

  it('validates short category names before calling the manager', () => {
    const { container } = render(<CreateCategory />);

    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: 'A' } });
    fireEvent.submit(container.querySelector('form'));

    expect(onCreateCategorySubmit).not.toHaveBeenCalled();
    expect(container.querySelector('input[name="name"]').className).not.toBe('');
  });

  it('submits a valid category name with router and category reload dependencies', async () => {
    const mockRouterPush = vi.fn();
    const { container } = render(<CreateCategory />, { mockRouterPush });

    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: ' Candles ' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(onCreateCategorySubmit).toHaveBeenCalled());

    const [values, setSuccess, setError, setInvalidFields, router, reload] = onCreateCategorySubmit.mock.calls[0];

    expect(values).toEqual({ name: ' Candles ' });
    expect(setSuccess).toEqual(expect.any(Function));
    expect(setError).toEqual(expect.any(Function));
    expect(setInvalidFields).toEqual(expect.any(Function));
    expect(router.push).toBe(mockRouterPush);
    expect(reload).toBe(triggerCategoriesReload);
  });

  it('renders manager errors returned by the submit flow', async () => {
    onCreateCategorySubmit.mockImplementationOnce((values, setSuccess, setError, setInvalidFields) => {
      setSuccess(false);
      setError('Category already exists');
      setInvalidFields(['name']);
    });
    const { container } = render(<CreateCategory />);

    fireEvent.change(container.querySelector('input[name="name"]'), { target: { value: 'Candles' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(container.textContent).toContain('Category already exists'));
    expect(container.querySelector('input[name="name"]').className).not.toBe('');
  });
});
