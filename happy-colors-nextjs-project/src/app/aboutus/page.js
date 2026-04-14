import styles from './about.module.css';

export const metadata = {
  title: {
    absolute: 'За Happy Colors | Плетени играчки и декорация за дома',
  },
  description:
    'Научи повече за Happy Colors и за ръчно изработените плетени играчки, аксесоари и декорация за дома, създадени с внимание към детайла.',
  alternates: {
    canonical: '/aboutus',
  },
};

export default function AboutUs() {
  return (
    <>
      <section className={styles.aboutSection}>
        <div className={styles.aboutImage} aria-hidden="true">
          <picture className={styles.aboutPicture}>
            <source media="(max-width: 768px)" srcSet="/aboutUs_Hero_banner_mobile.webp" />
            <source media="(min-width: 769px)" srcSet="/aboutUs_Hero_banner_laptop.webp" />
            <img
              className={styles.aboutHeroImage}
              src="/aboutUs_Hero_banner_laptop.webp"
              alt=""
              fetchPriority="high"
            />
          </picture>
        </div>

        <div className={styles.aboutText}>
          <h1>За Happy Colors и ръчно изработените плетени играчки</h1>
          <h4 className={styles.aboutSubtitle}>Изделия, създадени с търпение, любов и внимание към детайла.</h4>

          <p className={styles.homePageIntro}>
            Happy Colors се роди преди няколко години, когато открих, че плетенето на малки играчки и аксесоари ми носи спокойствие и радост. Постепенно това хоби се превърна в свят от ръчно изработени плетени играчки, аксесоари и красиви изделия с характер.
          
            Всяко изделие създавам с внимание към детайла, търпение и любов. За мен Happy Colors не е просто галерия, а малък свят, в който влагам сърце, вдъхновение и частица от себе си.
          </p>

          <p style={{ fontStyle: 'italic' }} className={styles.homePageIntro}>
            Благодаря ти, че си тук и отдели време да се докоснеш до света на Happy Colors.
          </p>
        </div>
      </section>

    </>
  );
}
