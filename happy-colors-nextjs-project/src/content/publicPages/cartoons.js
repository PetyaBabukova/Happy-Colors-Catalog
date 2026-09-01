function link(href, label) {
  return { href, label };
}

const unavailable = {
  bg: {
    title: 'Страницата не е намерена',
    description: 'Тази страница не е достъпна.',
  },
  en: {
    title: 'Page not found',
    description: 'This page is not available.',
  },
};

export const cartoonsPageContent = {
  bg: {
    metadata: {
      title: {
        absolute: 'Шарж по снимка и карикатура за подарък | Happy Colors',
      },
      description:
        'Превърнете любима снимка в забавен персонален шарж за рожден ден, юбилей, сватба, годишнина или друг специален повод.',
    },
    unavailable: unavailable.bg,
    intro: {
      title: 'Шарж по снимка за подарък с усмивка',
      paragraphs: [
        [
          'Превърнете любима снимка в забавен персонален шарж - за рожден ден, юбилей, сватба, годишнина или друг специален повод. Кажете ни идеята, изпратете снимка, а ние ще създадем артистичен портрет с настроение, характер и щипка закачка. Ако желаете, можем да разпечатаме карикатурата на фотохартия, на чаша или тениска. За повече информация вижте ',
          link('/cartoons/offer', 'вариантите и цените'),
          ' или изпратете запитване и снимки. Ако на този етап все още не желаете да предоставите снимки, използвайте ',
          link('/contacts', 'контактната форма'),
          '.',
        ],
        [
          'Всеки шарж е изработен индивидуално по снимка и идея на клиента. Рисунката се създава дигитално от графичен дизайнер с внимание към фините детайли и качеството на печат. Резултатът е персонално произведение на изкуството, създадено специално за вас.',
        ],
      ],
      ctaLabel: 'Изпрати запитване и снимки',
    },
  },
  en: {
    metadata: {
      title: {
        absolute: 'Caricature from Photo – Personalised Gift | Happy Colors',
      },
      description:
        'Order a personalised caricature from photo – a unique gift for birthdays, anniversaries, weddings and special occasions. Digital and print options available.',
    },
    unavailable: unavailable.en,
    intro: {
      title: 'Custom caricature from a photo for a memorable gift',
      paragraphs: [
        [
          'Turn a favorite photo into a playful personalized caricature for a birthday, anniversary, wedding, new home, retirement, professional milestone, or another special occasion. Tell us your idea, send reference photos, and we will create an artistic portrait with personality and a cheerful touch. For more information, see ',
          link('/cartoons/offer', 'options and prices'),
          ' or send an inquiry with photos. If you are not ready to share photos yet, use the ',
          link('/contacts', 'contact form'),
          '.',
        ],
        [
          'Each caricature is created individually from the customer’s photo and idea. The artwork is made digitally by a graphic designer with attention to detail and print quality. The result is a personal piece of art created especially for you.',
        ],
      ],
      ctaLabel: 'Send inquiry and photos',
    },
  },
};

export const cartoonsOfferPageContent = {
  bg: {
    metadata: {
      title: 'Варианти и ориентировъчни цени',
      description:
        'Вижте варианти за персонален шарж: печат на фотохартия, рамка, постер, добавки и ориентировъчни срокове за изработка.',
    },
    unavailable: unavailable.bg,
    hero: {
      logoAlt: 'Шарж Арт студио',
      kicker: 'Информация за шаржове',
      title: 'Варианти и ориентировъчни цени',
      lead:
        'Персонален шарж по снимка, подготвен като красив подарък според повода. Посочените цени са ориентировъчни, а финалната оферта зависи от броя лица, сложността на сцената, избрания формат и допълнителните варианти за печат или опаковка.',
      primaryCta: 'Изпрати запитване и снимки',
      secondaryCta: 'Виж галерията',
    },
    packages: {
      kicker: 'Основни варианти',
      title: 'Шарж на 1 лице - печат и рамка',
      items: [
        {
          title: 'Намален размер с печат и рамка',
          eyebrow: 'формат A4 - 297 x 210 мм',
          price: 'от 39 €',
          description:
            'Отпечатан шарж на луксозна хартия, подготвен като завършен подарък в рамка.',
        },
        {
          title: 'Базов размер с печат и рамка',
          eyebrow: 'формат A3 - 420 x 297 мм',
          price: 'от 49 €',
          description:
            'Подходящ за рождени дни, юбилеи, сватби, екипни подаръци и специални поводи.',
        },
        {
          title: 'Постер в тубус',
          eyebrow: 'произволен формат до 470 x 315 мм',
          price: 'по запитване',
          description:
            'Отпечатан постер, навит и опакован в тубус за удобно транспортиране и изпращане по куриер.',
        },
      ],
    },
    addOns: {
      imageAlt: 'Ръчно изработен подарък в ателие',
      kicker: 'Допълнителни опции',
      title: 'Добавки и подаръчни варианти',
      items: [
        { label: 'Дигитален файл (1 лице)', price: '30 €' },
        { label: '+1 лице', price: '+15 €' },
        { label: '+ домашен любимец', price: '+15 €' },
      ],
    },
    timeline: {
      kicker: 'Срокове',
      title: 'Ориентировъчни срокове за изработка',
      items: [
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
      ],
    },
    note: {
      kicker: 'Как да продължим',
      title: 'Изпратете идея, повод и снимки',
      parts: [
        'Ако все още не сте готови да изпратите снимки, пишете ни през ',
        link('/contacts', 'контактната форма'),
        '. За по-точна индивидуална оферта използвайте формата за шаржове и прикачете референтни снимки.',
      ],
      ctaLabel: 'Изпрати запитване и снимки',
    },
  },
  en: {
    metadata: {
      title: 'Options and guide prices',
      description:
        'See custom caricature options, including photo-paper prints, frames, posters, add-ons, and approximate production times.',
    },
    unavailable: unavailable.en,
    hero: {
      logoAlt: 'Caricature Art Studio',
      kicker: 'Caricature information',
      title: 'Options and guide prices',
      lead:
        'A custom caricature from a photo, prepared as a thoughtful gift for the occasion. Prices are guide prices; the final quote depends on the number of people, scene complexity, selected format, and any additional print or packaging options.',
      primaryCta: 'Send inquiry and photos',
      secondaryCta: 'View gallery',
    },
    packages: {
      kicker: 'Main options',
      title: 'One-person caricature - print and frame',
      items: [
        {
          title: 'Smaller print with frame',
          eyebrow: 'A4 format - 297 x 210 mm',
          price: 'from 39 €',
          description:
            'A caricature printed on premium paper and prepared as a finished framed gift.',
        },
        {
          title: 'Standard print with frame',
          eyebrow: 'A3 format - 420 x 297 mm',
          price: 'from 49 €',
          description:
            'Suitable for birthdays, anniversaries, weddings, team gifts, and special occasions.',
        },
        {
          title: 'Poster in a tube',
          eyebrow: 'custom format up to 470 x 315 mm',
          price: 'by inquiry',
          description:
            'A printed poster, rolled and packed in a tube for convenient transport and courier delivery.',
        },
      ],
    },
    addOns: {
      imageAlt: 'Handmade gift prepared in a studio',
      kicker: 'Additional options',
      title: 'Add-ons and gift options',
      items: [
        { label: 'Digital file (1 person)', price: '30 €' },
        { label: '+1 person', price: '+15 €' },
        { label: '+ pet', price: '+15 €' },
      ],
    },
    timeline: {
      kicker: 'Timing',
      title: 'Approximate production times',
      items: [
        {
          title: 'Standard production',
          time: 'up to 7 business days',
          note: 'suitable for planned gifts',
        },
        {
          title: 'Fast production',
          time: 'up to 3-4 business days',
          note: '+30% on the base price',
        },
        {
          title: 'Urgent production',
          time: 'when possible, up to 2 business days',
          note: '+50% on the base price',
        },
      ],
    },
    note: {
      kicker: 'Next step',
      title: 'Send your idea, occasion, and photos',
      parts: [
        'If you are not ready to send photos yet, write to us through the ',
        link('/contacts', 'contact form'),
        '. For a more accurate individual quote, use the caricature inquiry form and attach reference photos.',
      ],
      ctaLabel: 'Send inquiry and photos',
    },
  },
};

export function getCartoonsPageContent(locale = 'bg') {
  return cartoonsPageContent[locale] || cartoonsPageContent.bg;
}

export function getCartoonsOfferPageContent(locale = 'bg') {
  return cartoonsOfferPageContent[locale] || cartoonsOfferPageContent.bg;
}
