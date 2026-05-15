import CreateBlogArticleClient from './CreateBlogArticleClient';

export const metadata = {
  title: 'Създай блог статия',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreateBlogArticlePage() {
  return <CreateBlogArticleClient />;
}
