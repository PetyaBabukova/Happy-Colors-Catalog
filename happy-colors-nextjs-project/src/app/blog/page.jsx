import BlogArticleDetails from '@/components/blog/BlogArticleDetails';
import { getBlogPageContent } from '@/content/publicPages/blog';
import { buildPageMetadata } from '@/config/siteSeo';
import { getBlogArticle } from '@/lib/getBlogArticle';
import { getBlogArticles } from '@/managers/blogArticlesManager';
import styles from '@/components/blog/blogPublic.module.css';

export const dynamic = 'force-dynamic';

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
  let latestArticle = null;
  let loadError = '';

  try {
    articles = await getBlogArticles({ locale });
    latestArticle = articles[0]?._id ? await getBlogArticle(articles[0]._id, { locale }) : null;
  } catch (error) {
    console.error('Blog articles failed to load:', error);
    loadError = content.loadError;
  }

  return (
    <>
      {loadError && <main className={styles.blogPage}><p className={styles.errorState}>{loadError}</p></main>}
      {!loadError && !latestArticle && (
        <main className={styles.blogPage}>
          <p className={styles.emptyState}>{content.empty}</p>
        </main>
      )}
      {!loadError && latestArticle && <BlogArticleDetails article={latestArticle} articles={articles} />}
    </>
  );
}
