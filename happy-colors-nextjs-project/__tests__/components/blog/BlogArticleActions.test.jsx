import { beforeEach, describe, expect, it, vi } from 'vitest';
import BlogArticleActions from '@/components/blog/BlogArticleActions';
import { deleteBlogArticle } from '@/managers/blogArticlesManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/blogArticlesManager', () => ({
  deleteBlogArticle: vi.fn(),
}));

const articleId = 'a'.repeat(24);

describe('BlogArticleActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteBlogArticle.mockResolvedValue({ ok: true });
  });

  it('does not render article actions for guests', () => {
    const { container } = render(<BlogArticleActions articleId={articleId} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders edit and newsletter actions for authenticated users', () => {
    const { container } = render(<BlogArticleActions articleId={articleId} />, {
      user: { email: 'owner@example.com' },
    });

    expect(container.querySelector(`a[href="/blog/${articleId}/edit"]`)).toBeInTheDocument();
    const newsletterLink = container.querySelector(`a[href="/newsletter/send?source=blog&id=${articleId}"]`);

    expect(newsletterLink).toBeInTheDocument();
    expect(newsletterLink.className).toContain('newsletterActionLink');
  });

  it('deletes an article after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const mockRouterPush = vi.fn();
    const refresh = vi.fn();

    render(<BlogArticleActions articleId={articleId} />, {
      user: { email: 'owner@example.com' },
      mockRouterPush,
      routerOverrides: { refresh },
    });

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(deleteBlogArticle).toHaveBeenCalledWith(articleId));
    expect(mockRouterPush).toHaveBeenCalledWith('/blog');
    expect(refresh).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
