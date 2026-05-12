import HomepageFeaturedClient from './HomepageFeaturedClient';

export const metadata = {
  title: 'Избери любими продукти',
  robots: {
    index: false,
    follow: false,
  },
};

export default function HomepageFeaturedPage() {
  return <HomepageFeaturedClient />;
}
