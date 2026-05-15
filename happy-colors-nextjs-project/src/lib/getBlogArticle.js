import { cache } from 'react';

import { getBlogArticleById } from '@/managers/blogArticlesManager';

export const getBlogArticle = cache(async (articleId) => {
  try {
    const article = await getBlogArticleById(articleId);

    if (!article || typeof article !== 'object') {
      return null;
    }

    return article;
  } catch (error) {
    console.error(`Грешка при зареждане на блог статия ${articleId}:`, error);
    return null;
  }
});
