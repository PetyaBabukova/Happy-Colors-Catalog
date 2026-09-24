import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AiVisualLabel from '@/components/ui/AiVisualLabel';

describe('AiVisualLabel', () => {
  it('renders the Bulgarian label by default', () => {
    render(<AiVisualLabel />);

    expect(screen.getByText('AI визуализация'))
      .toHaveAttribute('lang', 'bg');
    expect(screen.getByText('AI визуализация'))
      .toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the English label for the English locale', () => {
    render(<AiVisualLabel locale="en" />);

    expect(screen.getByText('AI visual')).toHaveAttribute('lang', 'en');
  });
});
