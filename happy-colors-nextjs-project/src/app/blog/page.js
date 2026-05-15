import BlogArticleDetails from '@/components/blog/BlogArticleDetails';
import { getBlogArticle } from '@/lib/getBlogArticle';
import { getBlogArticles } from '@/managers/blogArticlesManager';
import styles from '@/components/blog/blogPublic.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Блог',
  description: 'Идеи, истории и вдъхновение за ръчно изработени подаръци, плетени играчки и уютна декорация от Happy Colors.',
  alternates: {
    canonical: '/blog',
  },
};

export default async function BlogPage() {
  let articles = [];
  let latestArticle = null;
  let loadError = '';

  try {
    articles = await getBlogArticles();
    latestArticle = articles[0]?._id ? await getBlogArticle(articles[0]._id) : null;
  } catch (error) {
    console.error('Грешка при зареждане на блог статиите:', error);
    loadError = 'Блог статиите не могат да бъдат заредени в момента.';
  }

  return (
    <>
      {loadError && <main className={styles.blogPage}><p className={styles.errorState}>{loadError}</p></main>}
      {!loadError && !latestArticle && (
        <main className={styles.blogPage}>
          <p className={styles.emptyState}>Все още няма публикувани блог статии.</p>
        </main>
      )}
      {!loadError && latestArticle && <BlogArticleDetails article={latestArticle} articles={articles} />}
    </>
  );
}
