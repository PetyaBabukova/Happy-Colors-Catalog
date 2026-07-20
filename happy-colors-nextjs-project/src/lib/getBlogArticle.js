import { cache } from 'react';

import { getBlogArticleById } from '@/managers/blogArticlesManager';

export const getBlogArticle = cache(async (articleId, { locale } = {}) => {
  try {
    const article = await getBlogArticleById(articleId, { locale });

    if (!article || typeof article !== 'object') {
      return null;
    }

    return article;
  } catch (error) {
    console.error(`Грешка при зареждане на блог статия ${articleId}:`, error);
    return null;
  }
});
