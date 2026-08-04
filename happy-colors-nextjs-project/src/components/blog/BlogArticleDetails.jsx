'use client';

import Link from 'next/link';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import useTranslations from '@/i18n/useTranslations';
import BlogArticleActions from './BlogArticleActions';
import styles from './blogPublic.module.css';

function formatDate(value, formatter) {
  if (!value) {
    return '';
  }

  try {
    return formatter(value);
  } catch {
    return '';
  }
}

export default function BlogArticleDetails({ article, articles = [] }) {
  const { t, formatVisibleDate } = useTranslations('blog');
  const { publicHref } = useLocaleNavigation();
  const publishedAt = article.publishedAt || article.createdAt;
  const publishedDate = formatDate(publishedAt, formatVisibleDate);
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
            <time className={styles.articleMeta} dateTime={publishedAt}>
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
        <aside className={styles.articleAside} aria-label={t('asideLabel')}>
          <h2>{t('asideTitle')}</h2>
          <ul className={styles.asideList}>
            {asideArticles.map((asideArticle) => {
              const asidePublishedAt = asideArticle.publishedAt || asideArticle.createdAt;
              const asidePublishedDate = formatDate(asidePublishedAt, formatVisibleDate);

              return (
                <li key={asideArticle._id}>
                  <Link
                    href={publicHref(`/blog/${asideArticle._id}`)}
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
                      {asidePublishedDate && (
                        <time dateTime={asidePublishedAt}>
                          {asidePublishedDate}
                        </time>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>
      )}
    </main>
  );
}
