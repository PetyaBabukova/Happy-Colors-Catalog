import EditHomeBannerClient from './EditHomeBannerClient';

export const metadata = {
  title: 'Редактиране на хоум банер',
  robots: {
    index: false,
    follow: false,
  },
};

export default function EditHomeBannerPage({ params }) {
  return <EditHomeBannerClient params={params} />;
}
