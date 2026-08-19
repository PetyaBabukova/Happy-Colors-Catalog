export const GIFT_HUB_PATH = '/gifts';

export const GIFT_GUIDE_SLUGS = Object.freeze([
  'gifts-for-children',
  'handmade-crochet-toy-gift',
  'original-handmade-gift',
]);

function link(href, label) {
  return { href, label };
}

export const giftsPageContent = {
  bg: {
    metadata: {
      title: 'Идеи за подарък',
      description:
        'Открийте идеи за ръчно изработен подарък от Happy Colors - плетени играчки, аксесоари и уютни декорации за деца, рожден ден и специални поводи.',
    },
    hub: {
      metadata: {
        title: 'Идеи за подарък',
        description:
          'Открийте идеи за ръчно изработен подарък от Happy Colors - плетени играчки, аксесоари и уютни декорации за деца, рожден ден и специални поводи.',
      },
      title: 'Идеи за подарък',
      intro:
        'Когато търсите подарък с характер, ръчно изработените изделия помагат изборът да бъде по-личен. Тук са събрани кратки насоки според повода, човека и усещането, което искате да подарите.',
      lead:
        'Разгледайте първите gift guide теми и продължете към каталога, FAQ или контактната форма, когато искате да уточните наличност, срок или индивидуална идея.',
      guideSectionTitle: 'Изберете посока',
      browseLabel: 'Разгледай идеята',
      supportTitle: 'Как да продължите',
      supportItems: [
        {
          title: 'Разгледайте каталога',
          text: 'Вижте наличните плетени играчки, аксесоари и декорации.',
          cta: link('/products', 'Към каталога'),
        },
        {
          title: 'Проверете детайлите',
          text: 'Във FAQ има отговори за наличност, материали, доставка и грижа.',
          cta: link('/faq', 'Към въпросите'),
        },
        {
          title: 'Попитайте спокойно',
          text: 'Изпратете запитване, ако подаръкът трябва да пасне на конкретен повод.',
          cta: link('/contacts', 'Контакт'),
        },
      ],
    },
    guides: {
      'gifts-for-children': {
        metadata: {
          title: 'Подаръци за деца - ръчно изработени идеи',
          description:
            'Идеи за ръчно изработени подаръци за деца от Happy Colors - меки плетени играчки, комплекти и цветни изделия с внимание към детайла.',
        },
        title: 'Подаръци за деца',
        summary:
          'Подаръкът за дете е най-хубав, когато е мек, цветен и лесен за обикване. Плетените играчки и малките комплекти могат да бъдат мил спомен за рожден ден, детска стая или специален празник.',
        sections: [
          {
            title: 'Какво да гледате при избора',
            text:
              'Помислете за възрастта на детето, цветовете, които харесва, и начина, по който подаръкът ще се използва - за игра, снимки, декорация или гушкане. За по-малки деца по-семплите форми и стабилно закрепените детайли са по-подходящи.',
          },
          {
            title: 'Подходящи посоки',
            text:
              'Меки плетени животни, малки цветни герои, комплекти с раничка и изделия за детска стая са естествен избор. Ако подаръкът е за конкретен повод, може да се съобрази с тема, сезон или любим цвят.',
          },
          {
            title: 'Преди да попитате',
            text:
              'Добре е да посочите възрастта на детето, повода и дали търсите наличен продукт или идея за изработка. Така отговорът за възможности и срок ще бъде по-точен.',
          },
        ],
        pathCards: [
          {
            title: 'Меки плетени играчки',
            text: 'Добър избор за мил, цветен и запомнящ се детски подарък.',
            href: '/products',
          },
          {
            title: 'Въпроси за безопасност и грижа',
            text: 'Вижте как да изберете според възрастта и детайлите на изделието.',
            href: '/faq',
          },
          {
            title: 'Запитване за конкретен повод',
            text: 'Опишете детето, повода и желаното усещане за подаръка.',
            href: '/contacts',
          },
        ],
      },
      'handmade-crochet-toy-gift': {
        metadata: {
          title: 'Плетена играчка като подарък',
          description:
            'Кога плетената играчка е добър подарък и как да изберете ръчно изработено изделие от Happy Colors според човека и повода.',
        },
        title: 'Плетена играчка като подарък',
        summary:
          'Плетената играчка носи усещане за топлина и личен избор. Тя не е просто предмет, а малък герой с цвят, форма и настроение, който може да остане като спомен.',
        sections: [
          {
            title: 'Защо работи като подарък',
            text:
              'Ръчно изработената играчка е подходяща, когато искате нещо по-меко и лично от стандартен подарък. Тя може да бъде за дете, за човек, който обича уютни детайли, или като част от тематична изненада.',
          },
          {
            title: 'Как да изберете модел',
            text:
              'Изберете според цветовете, размера и характера на човека. Веселите животни са добри за детски подаръци, а по-нежните модели могат да стоят красиво и като декорация.',
          },
          {
            title: 'Какво да уточните',
            text:
              'Проверете дали изделието е налично, какви са материалите и дали има дребни детайли. Ако искате конкретна цветова посока, изпратете запитване преди избора.',
          },
        ],
        pathCards: [
          {
            title: 'Разгледайте играчки и герои',
            text: 'Открийте налични изделия, които могат да се подарят веднага след потвърждение.',
            href: '/products',
          },
          {
            title: 'Идеи за деца',
            text: 'Ако подаръкът е за дете, вижте насоките според възраст и повод.',
            href: '/gifts/gifts-for-children',
          },
          {
            title: 'Попитайте за персонална идея',
            text: 'Кратко запитване помага изборът да стане по-точен.',
            href: '/contacts',
          },
        ],
      },
      'original-handmade-gift': {
        metadata: {
          title: 'Оригинален handmade подарък',
          description:
            'Идеи за оригинален handmade подарък от Happy Colors - ръчно изработени плетени изделия, аксесоари и декорации с характер.',
        },
        title: 'Оригинален handmade подарък',
        summary:
          'Оригиналният подарък не е задължително да бъде голям. Често е достатъчно да има ясна мисъл: цвят, текстура, тема или малък детайл, който пасва на човека.',
        sections: [
          {
            title: 'Кога handmade подаръкът е добър избор',
            text:
              'Подходящ е за рожден ден, благодарност, бебешки празник, нов дом или момент, в който искате подаръкът да изглежда избран внимателно, а не взет набързо.',
          },
          {
            title: 'Какви изделия да разгледате',
            text:
              'Плетените играчки са по-емоционални, аксесоарите са практични и цветни, а декорациите добавят уют. Комбинацията от малък предмет и лично послание често работи най-добре.',
          },
          {
            title: 'Как да избегнете случаен избор',
            text:
              'Започнете от човека: любим цвят, място у дома, повод или настроение. След това разгледайте каталога и попитайте за наличност, срок или възможна близка алтернатива.',
          },
        ],
        pathCards: [
          {
            title: 'Каталог с handmade изделия',
            text: 'Прегледайте наличните играчки, аксесоари и декорации.',
            href: '/products',
          },
          {
            title: 'Плетена играчка като подарък',
            text: 'Когато търсите нещо по-меко, лично и запомнящо се.',
            href: '/gifts/handmade-crochet-toy-gift',
          },
          {
            title: 'Контакт за уточнение',
            text: 'Пишете с повод, цветове и идея, за да получите по-точна насока.',
            href: '/contacts',
          },
        ],
      },
    },
    common: {
      breadcrumbHome: 'Начало',
      breadcrumbGifts: 'Подаръци',
      guidePathsTitle: 'Полезни следващи стъпки',
      backToHub: 'Всички идеи за подарък',
      primaryCta: 'Към каталога',
      secondaryCta: 'Изпрати запитване',
    },
  },
  en: {
    metadata: {
      title: 'Gift ideas',
      description:
        'Browse handmade gift ideas from Happy Colors: crochet toys, accessories, and cozy decor for children, birthdays, and thoughtful occasions.',
    },
    hub: {
      metadata: {
        title: 'Gift ideas',
        description:
          'Browse handmade gift ideas from Happy Colors: crochet toys, accessories, and cozy decor for children, birthdays, and thoughtful occasions.',
      },
      title: 'Gift ideas',
      intro:
        'When you want a gift with character, handmade pieces make the choice feel more personal. These short guides help you browse by occasion, recipient, and the feeling you want to give.',
      lead:
        'Start with the first gift guide topics, then continue to the catalog, FAQ, or contact form when you want to confirm availability, timing, or a custom idea.',
      guideSectionTitle: 'Choose a direction',
      browseLabel: 'Explore the idea',
      supportTitle: 'How to continue',
      supportItems: [
        {
          title: 'Browse the catalog',
          text: 'See available crochet toys, accessories, and decorations.',
          cta: link('/products', 'Go to catalog'),
        },
        {
          title: 'Check the details',
          text: 'The FAQ covers availability, materials, delivery, and care.',
          cta: link('/faq', 'Open FAQ'),
        },
        {
          title: 'Ask without pressure',
          text: 'Send an inquiry if the gift needs to match a specific occasion.',
          cta: link('/contacts', 'Contact'),
        },
      ],
    },
    guides: {
      'gifts-for-children': {
        metadata: {
          title: 'Gifts for children - handmade ideas',
          description:
            'Handmade gift ideas for children from Happy Colors: soft crochet toys, colorful sets, and thoughtful pieces with character.',
        },
        title: 'Gifts for children',
        summary:
          'A gift for a child feels best when it is soft, colorful, and easy to love. Crochet toys and small sets can become a sweet memory for a birthday, nursery, or special celebration.',
        sections: [
          {
            title: 'What to consider',
            text:
              'Think about the child\'s age, favorite colors, and how the gift will be used: play, photos, room decor, or cuddling. For younger children, simpler shapes and secure details are usually a better direction.',
          },
          {
            title: 'Good gift directions',
            text:
              'Soft crochet animals, small colorful characters, toy-and-backpack sets, and nursery pieces are natural choices. For a specific occasion, the gift can follow a color, season, or theme.',
          },
          {
            title: 'Before you ask',
            text:
              'Mention the child\'s age, the occasion, and whether you need an available item or an idea that can be made. That makes the answer about options and timing more useful.',
          },
        ],
        pathCards: [
          {
            title: 'Soft crochet toys',
            text: 'A warm, colorful, and memorable direction for a child\'s gift.',
            href: '/products',
          },
          {
            title: 'Safety and care questions',
            text: 'Check how to choose according to age and product details.',
            href: '/faq',
          },
          {
            title: 'Ask for a specific occasion',
            text: 'Describe the child, occasion, and the feeling you want the gift to have.',
            href: '/contacts',
          },
        ],
      },
      'handmade-crochet-toy-gift': {
        metadata: {
          title: 'Handmade crochet toy as a gift',
          description:
            'When a handmade crochet toy makes a good gift and how to choose a Happy Colors piece by person, occasion, and style.',
        },
        title: 'Handmade crochet toy as a gift',
        summary:
          'A crochet toy carries warmth and intention. It is not just an object, but a small character with color, shape, and mood that can stay as a memory.',
        sections: [
          {
            title: 'Why it works',
            text:
              'A handmade toy is a good choice when you want something softer and more personal than a standard gift. It can be for a child, for someone who loves cozy details, or as part of a themed surprise.',
          },
          {
            title: 'How to choose a model',
            text:
              'Choose by color, size, and the personality of the recipient. Cheerful animals work well for children, while gentler pieces can also look beautiful as decor.',
          },
          {
            title: 'What to confirm',
            text:
              'Check availability, materials, and whether the item includes small details. If you need a specific color direction, send an inquiry before deciding.',
          },
        ],
        pathCards: [
          {
            title: 'Browse toys and characters',
            text: 'Find available pieces that can become gifts after confirmation.',
            href: '/products',
          },
          {
            title: 'Ideas for children',
            text: 'If the gift is for a child, start with age and occasion.',
            href: '/gifts/gifts-for-children',
          },
          {
            title: 'Ask about a personal idea',
            text: 'A short inquiry can make the choice more precise.',
            href: '/contacts',
          },
        ],
      },
      'original-handmade-gift': {
        metadata: {
          title: 'Original handmade gift',
          description:
            'Ideas for an original handmade gift from Happy Colors: crochet pieces, accessories, and decor with character.',
        },
        title: 'Original handmade gift',
        summary:
          'An original gift does not have to be large. Often it simply needs a clear thought: a color, texture, theme, or small detail that fits the person.',
        sections: [
          {
            title: 'When handmade is a good fit',
            text:
              'It works for birthdays, thank-you moments, baby celebrations, a new home, or any moment when the gift should feel carefully chosen instead of generic.',
          },
          {
            title: 'What to browse',
            text:
              'Crochet toys feel more emotional, accessories are practical and colorful, and decorations add coziness. A small handmade piece with a personal note is often enough.',
          },
          {
            title: 'How to avoid a random choice',
            text:
              'Start with the person: favorite color, home corner, occasion, or mood. Then browse the catalog and ask about availability, timing, or a close alternative.',
          },
        ],
        pathCards: [
          {
            title: 'Catalog of handmade pieces',
            text: 'Browse available toys, accessories, and decorations.',
            href: '/products',
          },
          {
            title: 'Crochet toy as a gift',
            text: 'When you want something softer, more personal, and memorable.',
            href: '/gifts/handmade-crochet-toy-gift',
          },
          {
            title: 'Contact for guidance',
            text: 'Share the occasion, colors, and idea to get a more precise suggestion.',
            href: '/contacts',
          },
        ],
      },
    },
    common: {
      breadcrumbHome: 'Home',
      breadcrumbGifts: 'Gifts',
      guidePathsTitle: 'Helpful next steps',
      backToHub: 'All gift ideas',
      primaryCta: 'Browse catalog',
      secondaryCta: 'Send inquiry',
    },
  },
};

export function getGiftsPageContent(locale = 'bg') {
  return giftsPageContent[locale] || giftsPageContent.bg;
}

export function getGiftGuideContent(slug, locale = 'bg') {
  return getGiftsPageContent(locale).guides[slug] || null;
}

export function getGiftGuideCards(locale = 'bg') {
  const content = getGiftsPageContent(locale);

  return GIFT_GUIDE_SLUGS.map((slug) => ({
    slug,
    href: `${GIFT_HUB_PATH}/${slug}`,
    title: content.guides[slug].title,
    text: content.guides[slug].summary,
  }));
}
