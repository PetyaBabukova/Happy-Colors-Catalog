import {
  Check,
  Gift,
  MessageCircleHeart,
  MessageCircleQuestion,
  WandSparkles,
} from 'lucide-react';
import Link from 'next/link';
import styles from './about.module.css';

const craftHighlights = [
  'Ръчна изработка',
  'Внимание към детайла',
  'Меки цветове и характер',
  'Подходящо за подарък',
];

const usefulLinks = [
  {
    href: '/products',
    title: 'Каталог',
    text: 'Разгледайте наличните плетени играчки, аксесоари и декорации.',
    Icon: Gift,
  },
  {
    href: '/faq',
    title: 'Често задавани въпроси',
    text: 'Вижте повече за запитвания, материали, доставка и грижа за изделията.',
    Icon: MessageCircleQuestion,
  },
  {
    href: '/contacts',
    title: 'Контакти',
    text: 'Изпратете запитване за конкретно изделие или индивидуална изработка.',
    Icon: MessageCircleHeart,
  },
];

export const metadata = {
  title: {
    absolute: 'За Happy Colors | Хепи Колорс | Плетени играчки и декорация за дома',
  },
  description:
    'Научи повече за Happy Colors (Хепи Колорс) и за ръчно изработените плетени играчки, аксесоари и декорация за дома, създадени с внимание към детайла.',
  alternates: {
    canonical: '/aboutus',
  },
};

export default function AboutUs() {
  return (
    <main className={styles.aboutPage}>
      <section className={styles.heroSection} aria-labelledby="about-title">
        <picture className={styles.heroPicture}>
          <source media="(max-width: 768px)" srcSet="/lion_banner_MOBILE.webp" />
          <img
            className={styles.heroImage}
            src="/lion_banner.webp"
            alt="Плетено лъвче, раничка и цветни прежди от Happy Colors"
            fetchPriority="high"
          />
        </picture>

        <div className={styles.heroContent}>
          <h1 id="about-title">
            Happy Colors - свят от ръчно изработени плетени играчки, аксесоари и
            декорации
          </h1>
        </div>
      </section>

      <section className={styles.contentSection} aria-labelledby="story-title">
        <div className={styles.leftColumn}>
          <div className={styles.storyText}>
            <h2 id="story-title">Създадени с внимание, търпение и любов</h2>

            <p>
              Happy Colors се роди преди няколко години, когато открих, че плетенето на
              малки играчки и аксесоари ми носи спокойствие и радост. Постепенно това
              хоби се превърна в свят от ръчно изработени плетени играчки, аксесоари и
              красиви изделия с характер.
            </p>

            <p>
              Всяко изделие създавам с внимание към детайла, търпение и любов. За мен
              Happy Colors не е просто галерия, а малък свят, в който влагам сърце,
              вдъхновение и частица от себе си.
            </p>
          </div>

          <div className={styles.linksIntro}>
            <h2 id="links-title">Открийте още</h2>
            <p>
              Ако харесате конкретно изделие или имате идея за подарък, можете да
              разгледате каталога, да прочетете полезните отговори или да изпратите
              запитване без ангажимент.
            </p>
          </div>
        </div>

        <div className={styles.rightColumn}>
          <ul className={styles.highlightList} aria-label="Какво отличава Happy Colors">
            {craftHighlights.map((highlight) => (
              <li key={highlight}>
                <Check className={styles.checkIcon} aria-hidden="true" size={20} strokeWidth={2} />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>

          <nav className={styles.linkGrid} aria-label="Полезни връзки">
            {usefulLinks.map(({ href, title, text, Icon }) => (
              <Link key={href} className={styles.linkCard} href={href}>
                <Icon className={styles.linkIcon} aria-hidden="true" size={28} strokeWidth={1.7} />
                <span>{title}</span>
                <small>{text}</small>
              </Link>
            ))}

            <a
              className={styles.linkCard}
              href="https://webcreativeteam.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <WandSparkles className={styles.linkIcon} aria-hidden="true" size={28} strokeWidth={1.7} />
              <span>webcreativeteam.com</span>
              <small>Онлайн каталогът на Happy Colors е изработен от Web Creative Team.</small>
            </a>
          </nav>
        </div>
      </section>

      <section className={styles.closingSection} aria-label="Благодарност от Happy Colors">
        <p className={styles.thankYou}>
          Благодаря ти, че си тук и отдели време да се докоснеш до света на Happy
          Colors.
        </p>
      </section>
    </main>
  );
}
