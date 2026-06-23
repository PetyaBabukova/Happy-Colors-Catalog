import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isCartoonsServiceEnabled } from '@/config/cartoonsFeature';
import { buildPageMetadata } from '@/config/siteSeo';
import { buildCartoonServiceContactHref } from '@/utils/cartoonServiceRoutes';
import styles from './offer.module.css';

const PAGE_TITLE = 'Варианти и ориентировъчни цени';
const PAGE_DESCRIPTION =
  'Вижте draft оферта за персонален шарж: печат на фотохартия, рамка, постер, добавки, подаръчни опаковки и срокове за изработка.';

const BASE_PACKAGES = [
  {
    title: 'Намален размер с печат и рамка',
    eyebrow: 'формат А4 - 297 x 210 мм',
    price: 'от 39 €',
    description: 'Отпечатан шарж на луксозна хартия, подготвен като завършен подарък в рамка.',
  },
  {
    title: 'Базов размер с печат и рамка',
    eyebrow: 'формат А3 - 420 x297 мм',
    price: 'от 49 €',
    description: 'Подходящ за рождени дни, юбилеи, сватби, екипни подаръци и специални поводи.',
  },
  {
    title: 'Постер в тубус',
    eyebrow: 'произволен формат до 470x315 мм',
    price: 'по запитване',
    description: 'Отпечатан постер, навит и опакован в тубус за удобно транспортиране, пращане по куриер и пр.',
  },
];

const ADD_ONS = [
  ['Дигитален файл на флашка (1 лице)', '30 €'],
  ['+1 лице', '+15 €'],
  ['+ домашен любимец (куче, коте и пр.)', '+15 €'],
  // ['Чаша с шарж', 'по запитване'],
  // ['Фланелка с шарж', 'по запитване'],
  // ['Опаковане в подаръчна кутия', 'по запитване'],
];

const TIMELINES = [
  {
    title: 'Нормална изработка',
    time: 'до 7 работни дни',
    note: 'подходяща за планирани подаръци',
  },
  {
    title: 'Бърза изработка',
    time: 'до 3-4 работни дни',
    note: '+30% върху основната цена',
  },
  {
    title: 'Спешна изработка',
    time: 'при възможност, до 2 работни дни',
    note: '+50% върху основната цена',
  },
];

export function generateMetadata() {
  if (!isCartoonsServiceEnabled) {
    return {
      title: 'Страницата не е намерена',
      description: 'Тази страница не е достъпна.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return buildPageMetadata({
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    path: '/cartoons/offer',
    indexable: true,
  });
}

export default function CartoonsOfferPage() {
  if (!isCartoonsServiceEnabled) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <picture className={styles.heroPicture}>
          <source
            media="(max-width: 640px)"
            srcSet="/Offer_page_hero_banner_MOBILE.webp"
          />
          <Image
            className={styles.heroImage}
            src="/Offer_page_hero_banner.webp"
            alt=""
            fill
            priority
            sizes="100vw"
          />
        </picture>
        <div className={`${styles.heroContent} pageInline`}>
          <Image
            className={styles.logo}
            src="/LOGO.webp"
            alt="Шарж Арт студио"
            width={720}
            height={191}
            priority
          />
          <p className={styles.kicker}>ИНФОРМАЦИЯ ЗА ШАРЖОВЕ</p>
          <h1>{PAGE_TITLE}</h1>
          <p className={styles.lead}>
            Персонален шарж по снимка, подготвен като красив подарък според повода. Посочените цени са ориентировъчни, а финалната оферта зависи от броя лица, сложността на сцената, избрания формат и допълнителните варианти за печат или опаковка.
          </p>
          <div className={styles.heroActions}>
            <Link href={buildCartoonServiceContactHref()} className={styles.primaryButton}>
              Изпрати запитване и снимки
            </Link>
            <Link href="/cartoons" className={styles.secondaryButton}>
              Виж галерията
            </Link>
          </div>
        </div>
      </section>

      <section className={`${styles.priceSection} pageInline`} aria-labelledby="base-prices">
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>Основни варианти</p>
          <h2 id="base-prices">Шарж на 1 лице — печат и рамка</h2>
        </div>
        <div className={styles.packageGrid}>
          {BASE_PACKAGES.map((item) => (
            <article className={styles.packageCard} key={item.title}>
              <span>{item.eyebrow}</span>
              <h3>{item.title}</h3>
              <p className={styles.price}>{item.price}</p>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.splitSection} pageInline`}>
        <div className={styles.photoPanel}>
          <Image
            src="/Offer_page__bdy_image.webp"
            alt="Ръчно изработен подарък в ателие"
            fill
            sizes="(max-width: 768px) 100vw, 42vw"
          />
        </div>
        <div className={styles.addOnsPanel}>
          <p className={styles.kicker}>Допълнителни опции</p>
          <h2>Добавки и подаръчни варианти</h2>
          <dl className={styles.addOnsList}>
            {ADD_ONS.map(([label, price]) => (
              <div className={styles.addOnRow} key={label}>
                <dt>{label}</dt>
                <dd>{price}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className={`${styles.timelineSection} pageInline`} aria-labelledby="timeline-title">
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>Срокове</p>
          <h2 id="timeline-title">Ориентировъчни срокове за изработка</h2>
        </div>
        <div className={styles.timelineGrid}>
          {TIMELINES.map((item) => (
            <article className={styles.timelineItem} key={item.title}>
              <h3>{item.title}</h3>
              <p className={styles.timelineTime}>{item.time}</p>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.noteSection} pageInline`}>
        <div>
          <p className={styles.kicker}>Как да продължим</p>
          <h2>Изпратете идея, повод и снимки</h2>
          <p>
            Ако все още не сте готови да изпратите снимки, пишете ни през  {' '}
            <Link href="/contacts">контактната форма.</Link> За по-точна индивидуална оферта използвайте формата за шаржове и прикачете референтни снимки.
          </p>
        </div>
        <Link href={buildCartoonServiceContactHref()} className={styles.primaryButton}>
          Изпрати запитване и снимки
        </Link>
      </section>
    </main>
  );
}
