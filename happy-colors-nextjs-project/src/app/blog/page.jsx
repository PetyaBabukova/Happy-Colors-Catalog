import BlogArticleDetails from '@/components/blog/BlogArticleDetails';
import { getBlogPageContent } from '@/content/publicPages/blog';
import { buildPageMetadata } from '@/config/siteSeo';
import { getBlogArticles } from '@/managers/blogArticlesManager';
import styles from '@/components/blog/blogPublic.module.css';

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const locale = params?.locale;
  const content = getBlogPageContent(locale);

  return buildPageMetadata({
    ...content.metadata,
    path: '/blog',
    locale,
  });
}

export default async function BlogPage(props = {}) {
  const params = await props.params;
  const locale = params?.locale;
  const content = getBlogPageContent(locale);
  let articles = [];
  let loadError = '';
  let detailError = '';

  try {
    articles = await getBlogArticles({ locale });
  } catch (error) {
    console.error('Blog articles failed to load:', error);
    loadError = content.loadError;
  }

  const visibleArticles = articles.filter((article) => article?._id);
  const latestArticle = visibleArticles[0] || null;
  detailError = !loadError && articles.length > 0 && visibleArticles.length === 0
    ? content.detailError || content.loadError
    : '';

  return (
    <>
      {loadError && <main className={styles.blogPage}><p className={styles.errorState}>{loadError}</p></main>}
      {!loadError && detailError && (
        <main className={styles.blogPage}>
          <p className={styles.errorState}>{detailError}</p>
        </main>
      )}
      {!loadError && !detailError && visibleArticles.length === 0 && (
        <main className={styles.blogPage}>
          <p className={styles.emptyState}>{content.empty}</p>
        </main>
      )}
      {!loadError && !detailError && latestArticle && (
        <BlogArticleDetails article={latestArticle} articles={visibleArticles} />
      )}
    </>
  );
}
