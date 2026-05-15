import EditBlogArticleClient from './EditBlogArticleClient';

export const metadata = {
  title: 'Редактирай блог статия',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EditBlogArticlePage({ params }) {
  const { articleId } = await params;

  return <EditBlogArticleClient articleId={articleId} />;
}
