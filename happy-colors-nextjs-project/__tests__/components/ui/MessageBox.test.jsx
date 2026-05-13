import { describe, expect, it } from 'vitest';

import MessageBox from '@/components/ui/MessageBox';
import styles from '@/components/ui/MessageBox.module.css';
import { render, screen } from '../test-utils.jsx';

describe('MessageBox', () => {
  it('renders the provided message', () => {
    render(<MessageBox message="Something went wrong" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('applies success styling when type is success', () => {
    render(<MessageBox type="success" message="Saved" />);

    expect(screen.getByText('Saved')).toHaveClass(styles.success);
  });

  it('applies error styling by default', () => {
    render(<MessageBox message="Invalid" />);

    expect(screen.getByText('Invalid')).toHaveClass(styles.error);
  });
});
