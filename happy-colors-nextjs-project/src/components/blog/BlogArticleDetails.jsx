import Link from 'next/link';
import BlogArticleActions from './BlogArticleActions';
import styles from './blogPublic.module.css';

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('bg-BG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function BlogArticleDetails({ article, articles = [] }) {
  const publishedDate = formatDate(article.publishedAt || article.createdAt);
  const asideArticles = articles.filter((item) => item?._id);

  return (
    <main className={styles.articleLayout}>
      <div className={styles.heroImageWrap}>
        <img
          src={article.heroImageUrl}
          alt={article.heroImageAlt || article.title}
          className={styles.heroImage}
          loading="eager"
        />
      </div>

      <article className={styles.articlePage}>
        <header className={styles.articleHeader}>
          <h1 className={styles.articleTitle}>{article.title}</h1>
          {publishedDate && (
            <time className={styles.articleMeta} dateTime={article.publishedAt || article.createdAt}>
              {publishedDate}
            </time>
          )}
          <BlogArticleActions articleId={article._id} />
        </header>

        <div
          className={styles.articleBody}
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />
      </article>

      {asideArticles.length > 0 && (
        <aside className={styles.articleAside} aria-label="Други теми">
          <h2>Други теми:</h2>
          <ul className={styles.asideList}>
            {asideArticles.map((asideArticle) => (
              <li key={asideArticle._id}>
                <Link
                  href={`/blog/${asideArticle._id}`}
                  className={`${styles.asideLink} ${asideArticle._id === article._id ? styles.asideLinkActive : ''}`}
                  aria-current={asideArticle._id === article._id ? 'page' : undefined}
                >
                  {asideArticle.thumbnailImageUrl && (
                    <span className={styles.asideImageWrap}>
                      <img
                        src={asideArticle.thumbnailImageUrl}
                        alt=""
                        className={styles.asideImage}
                      />
                    </span>
                  )}
                  <span>
                    <strong>{asideArticle.title}</strong>
                    {formatDate(asideArticle.publishedAt || asideArticle.createdAt) && (
                      <time dateTime={asideArticle.publishedAt || asideArticle.createdAt}>
                        {formatDate(asideArticle.publishedAt || asideArticle.createdAt)}
                      </time>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </main>
  );
}
