import { beforeEach, describe, expect, it, vi } from 'vitest';
import RichTextEditor from '@/components/blog/RichTextEditor';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

describe('RichTextEditor', () => {
  beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'prompt').mockRestore?.();
  });

  it('renders TipTap formatting controls and marks the editor invalid when requested', async () => {
    render(<RichTextEditor id="content" invalid />);

    expect(screen.getByLabelText('Форматиране')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Получерно' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Линк' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Заглавие 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подравняване център' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Съдържание' })).toHaveAttribute('id', 'content');
    expect(screen.getByRole('textbox', { name: 'Съдържание' }).closest('div[class*="wrapper"]').className).toContain(
      'wrapperInvalid'
    );
  });

  it('renders initial HTML content in the editor', async () => {
    render(<RichTextEditor value="<p>Нов <strong>текст</strong></p>" />);

    const editor = await screen.findByRole('textbox', { name: 'Съдържание' });

    expect(editor).toHaveTextContent('Нов текст');
    expect(editor.querySelector('strong')).toHaveTextContent('текст');
  });

  it('syncs external value changes into the TipTap editor instance', async () => {
    const { rerender } = render(<RichTextEditor value="<p>Първи текст</p>" />);
    const editor = await screen.findByRole('textbox', { name: 'Съдържание' });

    expect(editor).toHaveTextContent('Първи текст');

    rerender(<RichTextEditor value="<p>Втори текст</p>" />);

    await waitFor(() => {
      expect(editor).toHaveTextContent('Втори текст');
    });
  });

  it('rejects unsafe link protocols before setting a link', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce('http://example.com');

    render(<RichTextEditor />);
    fireEvent.click(await screen.findByRole('button', { name: 'Линк' }));

    expect(window.alert).toHaveBeenCalledWith('Линковете трябва да започват с https:// или mailto:.');
  });

  it('keeps toolbar actions wired through TipTap without using execCommand', async () => {
    document.execCommand = vi.fn();

    render(<RichTextEditor value="<p>Текст</p>" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Получерно' }));
    fireEvent.click(screen.getByRole('button', { name: 'Курсив' }));
    fireEvent.click(screen.getByRole('button', { name: 'Заглавие 2' }));

    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it('emits HTML, JSON, and text when TipTap content changes', async () => {
    const onChange = vi.fn();

    render(<RichTextEditor value="<p>Начало</p>" onChange={onChange} />);
    await screen.findByRole('textbox', { name: 'Съдържание' });
    fireEvent.click(screen.getByRole('button', { name: 'Заглавие 2' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          contentHtml: expect.any(String),
          contentJson: expect.objectContaining({ type: 'doc' }),
          contentText: expect.any(String),
        })
      );
    });
  });
});
