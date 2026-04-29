import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useForm from '../../../src/hooks/useForm.js';

function HookHarness({ initialValues, onRender }) {
  onRender(useForm(initialValues));
  return null;
}

describe('useForm', () => {
  let container;
  let root;
  let current;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    vi.useRealTimers();
  });

  function renderHook(initialValues = { title: 'Initial' }) {
    act(() => {
      root.render(<HookHarness initialValues={initialValues} onRender={(value) => { current = value; }} />);
    });
  }

  it('initializes values and updates fields from change events', () => {
    renderHook();

    expect(current.formValues).toEqual({ title: 'Initial' });

    act(() => {
      current.handleChange({ target: { name: 'title', value: 'Updated' } });
    });

    expect(current.formValues).toEqual({ title: 'Updated' });
  });

  it('resets values, messages, and invalid fields', () => {
    renderHook({ title: 'Initial' });

    act(() => {
      current.setFormValues({ title: 'Changed' });
      current.setError('Bad');
      current.setSuccess(true);
      current.setInvalidFields(['title']);
    });

    act(() => {
      current.resetForm();
    });

    expect(current.formValues).toEqual({ title: 'Initial' });
    expect(current.error).toBe('');
    expect(current.success).toBe(false);
    expect(current.invalidFields).toEqual([]);
  });

  it('clears transient messages after the timeout', () => {
    renderHook();

    act(() => {
      current.setError('Bad');
      current.setSuccess(true);
    });

    expect(current.error).toBe('Bad');
    expect(current.success).toBe(true);

    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(current.error).toBe('');
    expect(current.success).toBe(false);
  });
});
