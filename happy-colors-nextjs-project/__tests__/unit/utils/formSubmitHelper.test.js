import { describe, expect, it, vi } from 'vitest';
import { handleSubmit } from '../../../src/utils/formSubmitHelper.js';

function buildHandlers() {
  return {
    event: { preventDefault: vi.fn() },
    setFormValues: vi.fn(),
    setSuccess: vi.fn(),
    setError: vi.fn(),
    setInvalidFields: vi.fn(),
    onSubmitFn: vi.fn(),
  };
}

describe('handleSubmit', () => {
  it('blocks submission when required fields are empty', () => {
    const handlers = buildHandlers();

    handleSubmit(
      handlers.event,
      { title: '', phone: '' },
      handlers.setFormValues,
      handlers.setSuccess,
      handlers.setError,
      handlers.setInvalidFields,
      handlers.onSubmitFn
    );

    expect(handlers.event.preventDefault).toHaveBeenCalledOnce();
    expect(handlers.setInvalidFields).toHaveBeenCalledWith(['title']);
    expect(handlers.setSuccess).toHaveBeenCalledWith(false);
    expect(handlers.onSubmitFn).not.toHaveBeenCalled();
  });

  it('blocks submission when a custom validator returns an error', () => {
    const handlers = buildHandlers();
    const validator = vi.fn().mockReturnValue({ fields: ['price'], message: 'Bad price' });

    handleSubmit(
      handlers.event,
      { title: 'Paint', price: '-1' },
      handlers.setFormValues,
      handlers.setSuccess,
      handlers.setError,
      handlers.setInvalidFields,
      handlers.onSubmitFn,
      [validator]
    );

    expect(validator).toHaveBeenCalledWith({ title: 'Paint', price: '-1' });
    expect(handlers.setInvalidFields).toHaveBeenCalledWith(['price']);
    expect(handlers.setError).toHaveBeenCalledWith('Bad price');
    expect(handlers.onSubmitFn).not.toHaveBeenCalled();
  });

  it('clears previous errors and delegates valid submissions', () => {
    const handlers = buildHandlers();
    const formValues = { title: 'Paint', price: '12' };

    handleSubmit(
      handlers.event,
      formValues,
      handlers.setFormValues,
      handlers.setSuccess,
      handlers.setError,
      handlers.setInvalidFields,
      handlers.onSubmitFn
    );

    expect(handlers.setInvalidFields).toHaveBeenCalledWith([]);
    expect(handlers.setError).toHaveBeenCalledWith('');
    expect(handlers.setSuccess).toHaveBeenCalledWith(false);
    expect(handlers.onSubmitFn).toHaveBeenCalledWith(
      formValues,
      handlers.setSuccess,
      handlers.setError,
      handlers.setInvalidFields
    );
  });
});
