import { notFound } from 'next/navigation';
import BlogArticleDetails from '@/components/blog/BlogArticleDetails';
import { getDictionary } from '@/i18n/getDictionary';
import { getBlogArticle } from '@/lib/getBlogArticle';
import { getBlogArticles } from '@/managers/blogArticlesManager';
import {
  buildBlogArticleJsonLd,
  buildBlogMetadata,
  shouldRenderBlogArticleJsonLd,
  stringifyJsonLd,
} from '@/utils/blogSeo';

export async function generateMetadata({ params: paramsPromise }) {
  const { articleId, locale } = await paramsPromise;
  const article = await getBlogArticle(articleId, { locale });

  if (!article) {
    const dictionary = getDictionary(locale || 'bg');

    return {
      title: dictionary.blog.notFoundTitle,
      description: dictionary.blog.notFoundDescription,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return buildBlogMetadata(article, articleId, locale);
}

export default async function BlogArticlePage({ params: paramsPromise }) {
  const { articleId, locale } = await paramsPromise;
  const [article, articles] = await Promise.all([
    getBlogArticle(articleId, { locale }),
    getBlogArticles({ locale }).catch(() => []),
  ]);

  if (!article) {
    notFound();
  }

  const articleJsonLd = shouldRenderBlogArticleJsonLd(article, locale)
    ? buildBlogArticleJsonLd(article, articleId, locale)
    : null;

  return (
    <>
      {articleJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(articleJsonLd) }}
        />
      ) : null}
      <BlogArticleDetails article={article} articles={articles} />
    </>
  );
}
