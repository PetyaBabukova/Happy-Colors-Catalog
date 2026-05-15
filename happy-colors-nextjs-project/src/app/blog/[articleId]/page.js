import { notFound } from 'next/navigation';
import BlogArticleDetails from '@/components/blog/BlogArticleDetails';
import { getBlogArticle } from '@/lib/getBlogArticle';
import { getBlogArticles } from '@/managers/blogArticlesManager';
import {
  buildBlogArticleJsonLd,
  buildBlogMetadata,
  stringifyJsonLd,
} from '@/utils/blogSeo';

export async function generateMetadata({ params: paramsPromise }) {
  const { articleId } = await paramsPromise;
  const article = await getBlogArticle(articleId);

  if (!article) {
    return {
      title: 'Блог статията не е намерена',
      description: 'Опитайте отново или изберете друга блог статия.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return buildBlogMetadata(article, articleId);
}

export default async function BlogArticlePage({ params: paramsPromise }) {
  const { articleId } = await paramsPromise;
  const [article, articles] = await Promise.all([
    getBlogArticle(articleId),
    getBlogArticles().catch(() => []),
  ]);

  if (!article) {
    notFound();
  }

  const articleJsonLd = buildBlogArticleJsonLd(article, articleId);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(articleJsonLd) }}
      />
      <BlogArticleDetails article={article} articles={articles} />
    </>
  );
}
