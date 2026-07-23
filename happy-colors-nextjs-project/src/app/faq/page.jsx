import Link from 'next/link';
import Image from 'next/image';
import { buildLocalizedAlternates } from '@/config/siteSeo';
import { getServerPublicHref } from '@/i18n/serverNavigation';
import styles from './faq.module.css';

function internalLink(href, label) {
  return { type: 'link', href, label };
}

const faqContent = {
  bg: {
    metadata: {
      title: 'Често задавани въпроси',
      description:
        'Отговори на най-честите въпроси за ръчно изработените плетени играчки, аксесоари и декорации от Happy Colors.',
    },
    hero: {
      title: 'Често задавани въпроси',
      lead:
        'Тук ще откриете отговори за наличност, индивидуални заявки, материали, подаръци, доставка и грижа за ръчно изработените изделия от Happy Colors.',
    },
    notice: {
      strong: 'Важно уточнение:',
      before:
        ' Happy Colors е онлайн каталог за ръчно изработени изделия. Сайтът не финализира автоматични онлайн поръчки и не приема онлайн плащания. Ако харесате продукт, може да изпратите запитване за наличност, срок и допълнителни уточнения от ',
      link: internalLink('/products', 'каталога'),
      after: '.',
    },
    sectionNavLabel: 'Раздели в често задавани въпроси',
    sections: [
      {
        id: 'inquiries',
        title: 'Запитвания и наличност',
        questions: [
          {
            question: 'Как мога да изпратя запитване за продукт?',
            answer: [
              'Ако сте харесали плетена играчка, раничка, комплект или декорация от ',
              internalLink('/products', 'каталога'),
              ', можете да изпратите запитване от продуктовата страница, през ',
              internalLink('/contacts', 'формата за контакт'),
              ' или по телефон.',
            ],
          },
          {
            question: 'Всички продукти ли са налични?',
            answer:
              'Не винаги. Част от изделията са налични, а други могат да бъдат изработени след предварително запитване.',
          },
          {
            question: 'Мога ли да поръчам индивидуална изработка?',
            answer: [
              'Да. Изпратете идеята си през ',
              internalLink('/contacts', 'контактната форма'),
              ' и ще получите информация дали изпълнението е възможно и какъв би бил ориентировъчният срок.',
            ],
          },
        ],
      },
      {
        id: 'products',
        title: 'Продукти и материали',
        questions: [
          {
            question: 'От какви материали са изработени продуктите?',
            answer:
              'Изделията се изработват от меки прежди и внимателно подбрани детайли. В описанието на всеки артикул е посочена наличната информация за материала, размера и особеностите.',
          },
          {
            question: 'Подходящи ли са плетените играчки за деца?',
            answer:
              'Много от плетените играчки могат да бъдат подходящи за деца, но изборът трябва да се съобрази с възрастта на детето и конкретните детайли на продукта.',
          },
          {
            question: 'Могат ли цветовете да се различават от снимките?',
            answer:
              'Възможна е лека разлика заради настройките на екрана, светлината при снимане и наличната прежда. Това е нормално за handmade изделия.',
          },
        ],
      },
      {
        id: 'gifts',
        title: 'Подаръци и поводи',
        questions: [
          {
            question: 'Подходящи ли са продуктите за подарък?',
            answer: [
              'Да. Плетените играчки, ранички, аксесоари и декорации са подходящи за рожден ден, бебешки празник, Коледа, детска стая или уютен акцент у дома. Разгледайте ',
              internalLink('/products', 'наличните предложения'),
              '.',
            ],
          },
          {
            question: 'Какъв продукт да избера за дете?',
            answer:
              'Добър избор са меките плетени животинки, комплектите с раничка и пухкавите изделия за гушкане. За по-малки деца е добре моделът да е по-семпъл.',
          },
          {
            question: 'Раничките подходящи ли са за ежедневна употреба?',
            answer:
              'Комплектите с плетена играчка и раничка са подходящи за подарък, игри, снимки и специални поводи. Раничките могат да носят леки детски вещи, но не са предназначени за тежък товар.',
          },
        ],
      },
      {
        id: 'delivery',
        title: 'Доставка и плащане',
        questions: [
          {
            question: 'Как се извършва доставката?',
            answer: [
              'Доставката се уточнява индивидуално след изпратено ',
              internalLink('/contacts', 'запитване'),
              ' и потвърждение.',
            ],
          },
          {
            question: 'Мога ли да платя онлайн през сайта?',
            answer:
              'Към момента сайтът е онлайн каталог и не финализира автоматични онлайн поръчки или плащания. Условията се уточняват индивидуално след запитване.',
          },
        ],
      },
      {
        id: 'care',
        title: 'Грижа за изделията',
        questions: [
          {
            question: 'Как се поддържат плетените играчки?',
            answer:
              'Препоръчително е внимателно почистване без агресивно търкане и силни препарати. След почистване изделието трябва да изсъхне добре на въздух.',
          },
          {
            question: 'Може ли плетена играчка да се пере в пералня?',
            answer:
              'За повечето изделия не се препоръчва машинно пране. Ръчното пране обикновено е по-безопасно за формата, мекотата и детайлите.',
          },
        ],
      },
      {
        id: 'contact',
        title: 'Контакт',
        questions: [
          {
            question: 'Как мога да се свържа с Happy Colors?',
            answer: [
              'Можете да използвате ',
              internalLink('/contacts', 'формата за контакт'),
              ' или бутона за запитване на продуктова страница.',
            ],
          },
          {
            question: 'Мога ли да задам въпрос преди да реша?',
            answer:
              'Разбира се. Можете да изпратите запитване без ангажимент. Уточненията са нормална част от избора на ръчно изработено изделие.',
          },
        ],
      },
    ],
    contact: {
      title: 'Не открихте отговор?',
      text:
        'Изпратете запитване без ангажимент и посочете кой продукт ви интересува, за да получите най-точна информация.',
      linkLabel: 'Свържете се с нас',
    },
  },
  en: {
    metadata: {
      title: 'Frequently asked questions',
      description:
        'Answers to common questions about handmade crochet toys, accessories, home decorations, inquiries, materials, delivery, and care from Happy Colors.',
    },
    hero: {
      title: 'Frequently asked questions',
      lead:
        'Find answers about handmade crochet toys, accessories, and home decorations from Happy Colors: availability, custom requests, materials, gifts, delivery, and care.',
    },
    notice: {
      strong: 'Important note:',
      before:
        ' Happy Colors is an online catalog for handmade pieces. The site does not complete automatic online orders or accept online payments. If you like a product, send an inquiry about availability, timing, and details from the ',
      link: internalLink('/products', 'catalog'),
      after: '.',
    },
    sectionNavLabel: 'Frequently asked question sections',
    sections: [
      {
        id: 'inquiries',
        title: 'Inquiries and availability',
        questions: [
          {
            question: 'How can I ask about a Happy Colors product?',
            answer: [
              'If you like a crochet toy, backpack, set, or decoration from the ',
              internalLink('/products', 'catalog'),
              ', you can send an inquiry from the product page, through the ',
              internalLink('/contacts', 'contact form'),
              ', or by phone.',
            ],
          },
          {
            question: 'Are all products available right now?',
            answer:
              'Not always. Some pieces are ready-made, while others can be made after an inquiry. Because every handmade piece is unique, availability may change.',
          },
          {
            question: 'Can I ask for a custom handmade item?',
            answer: [
              'Yes. You can send your idea through the ',
              internalLink('/contacts', 'contact form'),
              ' and I will let you know whether it can be made and what the approximate timing would be.',
            ],
          },
        ],
      },
      {
        id: 'products',
        title: 'Products and materials',
        questions: [
          {
            question: 'What materials are used?',
            answer:
              'Happy Colors pieces are made with soft yarns and carefully selected details. Product pages include the available information about materials, size, and specific features.',
          },
          {
            question: 'Are crochet toys suitable for children?',
            answer:
              'Many crochet toys can be suitable for children, but the choice should match the child’s age and the specific details of the item. Small children should play under adult supervision.',
          },
          {
            question: 'Can colors differ from the photos?',
            answer:
              'A slight color difference is possible because of screen settings, photo lighting, and yarn availability. This is normal for handmade products.',
          },
        ],
      },
      {
        id: 'gifts',
        title: 'Gifts and occasions',
        questions: [
          {
            question: 'Are the products suitable as gifts?',
            answer: [
              'Yes. Crochet toys, backpacks, accessories, and decorations are lovely handmade gifts for birthdays, baby celebrations, holidays, children’s rooms, or a cozy home accent. Browse the ',
              internalLink('/products', 'available pieces'),
              ' for ideas.',
            ],
          },
          {
            question: 'What should I choose for a child?',
            answer:
              'Soft crochet animals, toy-and-backpack sets, and cuddly pieces are often a good choice. For younger children, simpler models with fewer movable details are preferable.',
          },
          {
            question: 'Are backpack sets suitable for everyday use?',
            answer:
              'Toy-and-backpack sets are suitable for gifts, play, photos, and special occasions. The backpacks can hold light children’s items, but they are not intended for heavy loads.',
          },
        ],
      },
      {
        id: 'delivery',
        title: 'Delivery and payment',
        questions: [
          {
            question: 'How is delivery arranged?',
            answer: [
              'Delivery is confirmed individually after you send an ',
              internalLink('/contacts', 'inquiry'),
              '. The final option depends on the item, location, and courier availability.',
            ],
          },
          {
            question: 'Can I pay online through the site?',
            answer:
              'At the moment, the site is an online catalog and does not complete automatic online orders or online payments. Payment details are confirmed individually after an inquiry.',
          },
        ],
      },
      {
        id: 'care',
        title: 'Care',
        questions: [
          {
            question: 'How should crochet toys be cleaned?',
            answer:
              'Gentle hand cleaning is recommended. Avoid aggressive rubbing and strong detergents. Let the item dry well in open air after cleaning.',
          },
          {
            question: 'Can a crochet toy be washed in a washing machine?',
            answer:
              'Machine washing is not recommended for most pieces. Hand washing is usually safer for preserving the shape, softness, and details.',
          },
        ],
      },
      {
        id: 'contact',
        title: 'Contact',
        questions: [
          {
            question: 'How can I contact Happy Colors?',
            answer: [
              'Use the ',
              internalLink('/contacts', 'contact form'),
              ' or send an inquiry from a product page.',
            ],
          },
          {
            question: 'Can I ask a question before deciding?',
            answer:
              'Of course. You can send an inquiry with no obligation. Questions and clarifications are a normal part of choosing a handmade piece.',
          },
        ],
      },
    ],
    contact: {
      title: 'Did not find an answer?',
      text:
        'Send an inquiry with no obligation and mention the product you are interested in, so you can receive the most accurate information.',
      linkLabel: 'Contact us',
    },
  },
};

function getFaqContent(locale = 'bg') {
  return faqContent[locale] || faqContent.bg;
}

function plainTextFromAnswer(answer) {
  if (typeof answer === 'string') {
    return answer;
  }

  return answer
    .map((part) => (typeof part === 'string' ? part : part.label))
    .join('');
}

function buildFaqStructuredData(sections) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: sections.flatMap((section) =>
      section.questions.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: plainTextFromAnswer(item.answer),
        },
      }))
    ),
  };
}

function renderAnswer(answer, publicHref) {
  if (!Array.isArray(answer)) {
    return answer;
  }

  return answer.map((part, index) =>
    typeof part === 'string' ? (
      part
    ) : (
      <Link key={`${part.href}-${index}`} href={publicHref(part.href)}>
        {part.label}
      </Link>
    )
  );
}

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const locale = params?.locale;
  const content = getFaqContent(locale);

  return {
    ...content.metadata,
    alternates: buildLocalizedAlternates('/faq', locale),
  };
}

export default async function FaqPage(props = {}) {
  const params = await props.params;
  const locale = params?.locale;
  const content = getFaqContent(locale);
  const publicHref = (href) => getServerPublicHref(href, locale);
  const structuredData = buildFaqStructuredData(content.sections);

  return (
    <main className={`${styles.faqPage} pageInline`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className={styles.heroSection}>
        <Image
          className={styles.logo}
          src="/logo_64pxH.svg"
          alt="Happy Colors"
          width={256}
          height={256}
          priority
        />
        <h1>{content.hero.title}</h1>
        <p className={styles.lead}>{content.hero.lead}</p>
      </section>

      <aside className={styles.notice}>
        <strong>{content.notice.strong}</strong>
        {content.notice.before}
        <Link href={publicHref(content.notice.link.href)}>{content.notice.link.label}</Link>
        {content.notice.after}
      </aside>

      <nav className={styles.sectionNav} aria-label={content.sectionNavLabel}>
        {content.sections.map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            {section.title}
          </a>
        ))}
      </nav>

      <div className={styles.sections}>
        {content.sections.map((section) => (
          <section key={section.id} id={section.id} className={styles.faqSection}>
            <h2>{section.title}</h2>

            <div className={styles.questionList}>
              {section.questions.map((item) => (
                <details key={item.question} className={styles.questionItem}>
                  <summary>{item.question}</summary>
                  <p>{renderAnswer(item.answer, publicHref)}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className={styles.contactSection} aria-labelledby="faq-contact-title">
        <h2 id="faq-contact-title">{content.contact.title}</h2>
        <p>{content.contact.text}</p>
        <Link className={styles.contactLink} href={publicHref('/contacts')}>
          {content.contact.linkLabel}
        </Link>
      </section>
    </main>
  );
}
