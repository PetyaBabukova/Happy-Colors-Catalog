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
        'Идеи за ръчно изработен подарък от Happy Colors - плетени играчки, персонални шаржове и уютни handmade изделия за деца, рожден ден и специални поводи.',
    },
    hub: {
      metadata: {
        title: 'Идеи за подарък',
        description:
          'Идеи за ръчно изработен подарък от Happy Colors - плетени играчки, персонални шаржове и уютни handmade изделия за деца, рожден ден и специални поводи.',
      },
      eyebrow: 'Подаръци с характер',
      title: 'Идеи за подарък',
      intro:
        'Когато търсите подарък с лично усещане, най-лесно е да започнете не от продукта, а от човека. Тук събрахме кратки насоки за ръчно изработени подаръци, плетени играчки и персонални идеи, които могат да се изберат спокойно.',
      lead:
        'Изберете тема според повода, вижте какво има в каталога или пишете за уточнение, ако подаръкът трябва да пасне на конкретен човек, срок или цветова посока.',
      primaryCta: link('/products', 'Разгледай каталога'),
      secondaryCta: link('/cartoons', 'Виж шаржовете'),
      guideSectionTitle: 'Изберете посока',
      guideSectionIntro:
        'Подарък за дете, плетена играчка като подарък, оригинален handmade жест.',
      browseLabel: 'Разгледай идеята',
      decisionTitle: 'Как да изберете по-лесно',
      decisionIntro:
        'Не е нужно да имате готова идея. Достатъчни са няколко ориентира, за да стане изборът по-точен.',
      decisionSteps: [
        {
          title: 'За кого е подаръкът',
          text: 'Помислете за човека, когото искате да зарадвате - какво обича, кои са любимите му цветове и какво би го накарало да се усмихне. Така изборът става много по-личен.',
        },
        {
          title: 'Готово изделие или персонална идея',
          text: 'Ако подаръкът ви трябва скоро, разгледайте наличните предложения. А ако разполагате с повече време, можем да обсъдим идея, вдъхновена от любим цвят, тема или повод.',
        },
        {
          title: 'Какво усещане искате да остави',
          text: 'Весело и цветно, нежно и уютно или лично и запомнящо се? Помислете какво искате да носи подаръкът като настроение - това често е най-добрият ориентир.',
        },
      ],
      supportTitle: 'Следваща стъпка',
      supportItems: [
        {
          title: 'Каталог с налични изделия',
          text: 'Разгледайте плетени играчки, аксесоари и декорации, създадени с внимание към детайла. Може би точният подарък вече ви очаква в каталога.',
          cta: link('/products', 'Към каталога'),
        },
        {
          title: 'Персонален шарж по снимка',
          text: 'Подарък с настроение, хумор и лично послание. Шаржът по снимка превръща любим човек, момент или история в оригинален и запомнящ се подарък.',
          cta: link('/cartoons', 'Към шаржовете'),
        },
        {
          title: 'Въпроси за поръчка и грижа',
          text: 'Имате въпрос за изделие, материали, наличност, доставка или поддръжка? Тук ще намерите полезна информация, която да ви помогне преди избора и поръчката.',
          cta: link('/faq', 'Към въпросите'),
        },
        {
          title: 'Запитване за конкретен повод',
          text: 'Рожден ден, празник или специална изненада? Разкажете ни за повода, човека и идеята си, а ние ще ви помогнем да се насочите към подходящ подарък.',
          cta: link('/contacts', 'Контакт'),
        },
      ],
    },
    guides: {
      'gifts-for-children': {
        metadata: {
          title: 'Подаръци за деца - ръчно изработени идеи',
          description:
            'Идеи за ръчно изработени подаръци за деца от Happy Colors - пухкави плетени играчки, цветни герои и handmade изделия с внимание към детайла.',
        },
        eyebrow: 'Подарък за дете',
        title: 'Подаръци за деца',
        featureSectionTitle: 'Как да изберете подарък за дете',
        cardText:
          'Пухкави плетени играчки, цветни герои и малки handmade изделия, избрани според възраст, повод и любими цветове.',
        summary:
          'Една плетена играчка може да бъде много повече от подарък – мек приятел за гушкане, герой в детските игри и мил спомен от специален повод. Тя насърчава въображението и творческата игра и дава на детето свободата да измисля свои истории и приключения.',
        highlights: ['Пухкави плетени играчки', 'Цветни герои с характер', 'Развиват детската креативност'],
        sections: [
          {
            title: 'Започнете от възрастта и начина на ползване',
            text:
              'Изберете играчка според възрастта и начина на ползване - за игра, гушкане, снимки или детска стая.',
          },
          {
            title: 'Изберете тема, не просто предмет',
            text:
              'Животинче, герой или любим цвят правят подаръка по-личен и канят детето да измисля истории.',
          },
          {
            title: 'Уточнете наличност и важни детайли',
            text:
              'Ако срокът е важен, започнете от наличните изделия. За лична идея изпратете възраст, повод и цветове.',
          },
        ],
        pathCards: [
          {
            title: 'Плетени играчки',
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
        finalCta: {
          title: 'Готови ли сте да изберете подарък?',
          text:
            'Започнете от наличните изделия или изпратете кратко запитване, ако търсите подарък за конкретна възраст, цвят или празник.',
          actions: [
            link('/products', 'Разгледай каталога'),
            link('/contacts', 'Изпрати запитване'),
          ],
        },
      },
      'handmade-crochet-toy-gift': {
        metadata: {
          title: 'Плетена играчка като подарък',
          description:
            'Кога плетената играчка е добър подарък и как да изберете ръчно изработено изделие от Happy Colors според човека, повода и стила.',
        },
        eyebrow: 'Ръчно плетен подарък',
        title: 'Плетена играчка като подарък',
        featureSectionTitle: 'Как да изберете плетена играчка',
        cardText:
          'Кога плетената играчка е подходящ подарък и как да изберете модел според цвят, характер и повод.',
        summary:
          'Плетената играчка носи усещане за топлина и личен избор. Тя не е просто предмет, а малък герой с цвят, форма и настроение, който може да остане като спомен.',
        highlights: ['Handmade играчка', 'Топъл личен жест', 'Подарък с характер'],
        sections: [
          {
            title: 'Защо работи като подарък',
            text:
              'Ръчно изработената играчка е подходяща, когато искате нещо по-мило и лично от стандартен подарък. Тя може да бъде за дете, за човек, който държи на детайла, или като част от тематична изненада.',
          },
          {
            title: 'Как да изберете модел',
            text:
              'Изберете според цветовете, модела и характера на човека. Веселите животнинки и герои са добри за детски подаръци, а по-нежните модели могат да стоят красиво и като декорация.',
          },
          {
            title: 'Какво да уточните преди поръчка',
            text:
              'Проверете дали изделието е налично, ако не е - дали срокът за изработката ви устройва. Ако искате конкретна цветова посока, изпратете запитване преди избора.',
          },
        ],
        pathCards: [
          {
            title: 'Играчки и герои в каталога',
            text: 'Открийте налични изделия, които могат да се подарят след потвърждение.',
            href: '/products',
          },
          {
            title: 'Идеи за деца',
            text: 'Ако подаръкът е за дете, вижте насоките според възраст и повод.',
            href: '/gifts/gifts-for-children',
          },
          {
            title: 'Персонална идея',
            text: 'Кратко запитване помага изборът да стане по-точен.',
            href: '/contacts',
          },
        ],
        finalCta: {
          title: 'Намерете играчка с правилното настроение',
          text:
            'Вижте наличните плетени изделия или пишете, ако имате тема, любим цвят или повод, който подаръкът трябва да следва.',
          actions: [
            link('/products', 'Разгледай каталога'),
            link('/contacts', 'Изпрати запитване'),
          ],
        },
      },
      'original-handmade-gift': {
        metadata: {
          title: 'Оригинален handmade подарък',
          description:
            'Идеи за оригинален handmade подарък от Happy Colors - ръчно изработени плетени изделия, аксесоари, декорации и персонални шаржове.',
        },
        eyebrow: 'Личен жест',
        title: 'Оригинален handmade подарък',
        featureSectionTitle: 'Как да изберете оригинален подарък',
        cardText:
          'Идеи за подарък с по-лично усещане: плетени изделия, уютни handmade детайли и персонален шарж по снимка.',
        summary:
          'Понякога най-запомнящият се подарък е този, който е създаден с внимание и носи нещо лично. Handmade изделията са чудесен избор, когато търсите нещо различно, красиво и с характер.',
        highlights: ['Handmade подарък', 'Лична идея', 'Шарж по снимка'],
        sections: [
          {
            title: 'Кога handmade подаръкът е добър избор',
            text:
              'Подходящ е за рожден ден, благодарност, бебешки празник, нов дом или момент, в който искате подаръкът да изглежда избран внимателно, а не взет набързо.',
          },
          {
            title: 'Какви идеи да разгледате',
            text:
              'Плетените играчки са по-емоционални, аксесоарите са практични и цветни, а декорациите добавят уют. Когато търсите нещо още по-персонално, шаржът по снимка може да бъде забавен подарък, създаден за конкретен човек.',
          },
          {
            title: 'Как да избегнете случаен избор',
            text:
              'Започнете от човека: любим цвят, място у дома, повод или настроение. След това разгледайте каталога, шаржовете или попитайте за наличност, срок и близка алтернатива.',
          },
        ],
        pathCards: [
          {
            title: 'Каталог с handmade изделия',
            text: 'Прегледайте наличните играчки, аксесоари и декорации.',
            href: '/products',
          },
          {
            title: 'Персонален шарж',
            text: 'Идея за по-забавен и личен подарък, свързан с конкретен човек.',
            href: '/cartoons',
          },
          {
            title: 'Плетена играчка като подарък',
            text: 'Когато търсите нещо по-меко, лично и запомнящо се.',
            href: '/gifts/handmade-crochet-toy-gift',
          },
        ],
        finalCta: {
          title: 'Изберете подарък с лична посока',
          text:
            'Разгледайте наличните handmade изделия, вижте шаржовете или пишете с повод, цветове и идея, за да получите по-точна насока.',
          actions: [
            link('/products', 'Разгледай каталога'),
            link('/cartoons', 'Виж шаржовете'),
            link('/contacts', 'Изпрати запитване'),
          ],
        },
      },
    },
    common: {
      breadcrumbHome: 'Начало',
      breadcrumbGifts: 'Подаръци',
      backToHub: 'Виж всички подаръци',
    },
  },
  en: {
    metadata: {
      title: 'Gift ideas',
      description:
        'Handmade gift ideas from Happy Colors: crochet toys, personal cartoons, accessories, and cozy handmade pieces for children, birthdays, and thoughtful occasions.',
    },
    hub: {
      metadata: {
        title: 'Gift ideas',
        description:
          'Handmade gift ideas from Happy Colors: crochet toys, personal cartoons, accessories, and cozy handmade pieces for children, birthdays, and thoughtful occasions.',
      },
      eyebrow: 'Gifts with character',
      title: 'Gift ideas',
      intro:
        'When you want a gift to feel personal, the easiest place to start is the person, not the product. These short guides help you choose handmade gifts, crochet toys, and personal ideas without overthinking the search.',
      lead:
        'Pick a direction by occasion, browse what is available, or send a quick inquiry when the gift needs to match a specific person, deadline, or color direction.',
      primaryCta: link('/products', 'Browse catalog'),
      secondaryCta: link('/cartoons', 'View cartoons'),
      guideSectionTitle: 'Choose a direction',
      guideSectionIntro:
        'These first guides cover the most common searches: a gift for a child, a crochet toy as a gift, and a more original handmade gesture.',
      browseLabel: 'Explore the idea',
      decisionTitle: 'How to choose more easily',
      decisionIntro:
        'You do not need a finished idea. A few simple clues are enough to make the choice clearer.',
      decisionSteps: [
        {
          title: 'Who is the gift for?',
          text: 'Think about the person you want to make happy - what they love, their favorite colors, and what would make them smile. This makes the choice feel much more personal.',
        },
        {
          title: 'Ready-made item or personalized idea',
          text: 'If you need the gift soon, take a look at the available items. If you have more time, we can discuss an idea inspired by a favorite color, theme, or special occasion.',
        },
        {
          title: 'What feeling do you want the gift to create?',
          text: 'Cheerful and colorful, soft and cozy, or personal and memorable? Think about the mood you want the gift to bring - it is often the best guide when choosing.',
        },
      ],
      supportTitle: 'Next step',
      supportItems: [
        {
          title: 'Catalog of available items',
          text: 'Explore crochet toys, accessories, and decorations made with attention to detail. The perfect gift may already be waiting for you in the catalog.',
          cta: link('/products', 'Go to catalog'),
        },
        {
          title: 'Personalized caricature from a photo',
          text: 'A gift with personality, humor, and a personal touch. A caricature from a photo turns a favorite person, moment, or story into an original and memorable gift.',
          cta: link('/cartoons', 'View cartoons'),
        },
        {
          title: 'Questions about ordering and care',
          text: 'Have a question about an item, materials, availability, delivery, or care? Here you will find useful information to help you before choosing and placing an order.',
          cta: link('/faq', 'Open FAQ'),
        },
        {
          title: 'Enquiry for a specific occasion',
          text: 'Birthday, celebration, or special surprise? Tell us about the occasion, the person, and your idea, and we will help you find the right gift.',
          cta: link('/contacts', 'Contact'),
        },
      ],
    },
    guides: {
      'gifts-for-children': {
        metadata: {
          title: 'Gifts for children - handmade ideas',
          description:
            'Handmade gift ideas for children from Happy Colors: soft crochet toys, colorful characters, and thoughtful handmade pieces.',
        },
        eyebrow: 'Gift for a child',
        title: 'Gifts for children',
        featureSectionTitle: 'How to choose a gift for a child',
        cardText:
          'Crochet toys, colorful characters, and small handmade pieces chosen by age, occasion, and favorite colors.',
        summary:
          'A crochet toy can be much more than just a gift – a soft friend to cuddle, a character in a child’s games, and a cherished reminder of a special occasion. It encourages imagination and creative play, giving children the freedom to invent their own stories and adventures.',
        highlights: ['Crochet toys', 'Colorful characters', 'Encourage creativity'],
        sections: [
          {
            title: 'Start with age and use',
            text:
              'Choose a soft toy by age and use: play, cuddling, photos, or nursery decor.',
          },
          {
            title: 'Choose a theme, not just an item',
            text:
              'An animal, character, or favorite color makes the gift more personal and invites stories.',
          },
          {
            title: 'Confirm availability and details',
            text:
              'If timing matters, start with available pieces. For a personal idea, send age, occasion, and colors.',
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
        finalCta: {
          title: 'Ready to choose a gift?',
          text:
            'Start with available pieces or send a short inquiry if you need a gift for a specific age, color, or celebration.',
          actions: [
            link('/products', 'Browse catalog'),
            link('/contacts', 'Send inquiry'),
          ],
        },
      },
      'handmade-crochet-toy-gift': {
        metadata: {
          title: 'Handmade crochet toy as a gift',
          description:
            'When a handmade crochet toy makes a good gift and how to choose a Happy Colors piece by person, occasion, and style.',
        },
        eyebrow: 'Hand-crocheted idea',
        title: 'Handmade crochet toy as a gift',
        featureSectionTitle: 'How to choose a crochet toy',
        cardText:
          'When a crochet toy is the right gift and how to choose a model by color, character, and occasion.',
        summary:
          'A crochet toy brings a sense of warmth and a personal touch. It is more than just an object – it is a little character with its own color, shape, and personality that can become a cherished keepsake.',
        highlights: ['handmade toy', 'warm personal gesture', 'gift with character'],
        sections: [
          {
            title: 'Why it works as a gift',
            text:
              'A handmade toy is a good choice when you want something softer and more personal than a standard gift. It can be for a child, for someone who loves cozy details, or as part of a themed surprise.',
          },
          {
            title: 'How to choose a model',
            text:
              'Choose by color, size, and the personality of the recipient. Cheerful animals and characters work well for children, while gentler pieces can also look beautiful as decor.',
          },
          {
            title: 'What to confirm before ordering',
            text:
              'Check availability, materials, and whether the item includes small details. If you need a specific color direction, send an inquiry before deciding.',
          },
        ],
        pathCards: [
          {
            title: 'Toys and characters in the catalog',
            text: 'Find available pieces that can become gifts after confirmation.',
            href: '/products',
          },
          {
            title: 'Ideas for children',
            text: 'If the gift is for a child, start with age and occasion.',
            href: '/gifts/gifts-for-children',
          },
          {
            title: 'Personal idea',
            text: 'A short inquiry can make the choice more precise.',
            href: '/contacts',
          },
        ],
        finalCta: {
          title: 'Find a toy with the right mood',
          text:
            'Browse available crochet pieces or send a note if you have a theme, favorite color, or occasion the gift should follow.',
          actions: [
            link('/products', 'Browse catalog'),
            link('/contacts', 'Send inquiry'),
          ],
        },
      },
      'original-handmade-gift': {
        metadata: {
          title: 'Original handmade gift',
          description:
            'Ideas for an original handmade gift from Happy Colors: crochet pieces, accessories, decorations, and personal cartoons.',
        },
        eyebrow: 'Personal gesture',
        title: 'Original handmade gift',
        featureSectionTitle: 'How to choose an original gift',
        cardText:
          'Gift ideas with a more personal feeling: crochet pieces, cozy handmade details, and a personal cartoon from a photo.',
        summary:
          'Sometimes the most memorable gift is one that is made with care and has a personal touch. Handmade pieces are a wonderful choice when you’re looking for something different, beautiful, and full of character.',
        highlights: ['handmade gift', 'personal idea', 'cartoon from photo'],
        sections: [
          {
            title: 'When handmade is a good fit',
            text:
              'It works for birthdays, thank-you moments, baby celebrations, a new home, or any moment when the gift should feel carefully chosen instead of generic.',
          },
          {
            title: 'What ideas to browse',
            text:
              'Crochet toys feel more emotional, accessories are practical and colorful, and decorations add coziness. When you want something even more personal, a cartoon from a photo can be a playful gift made for one specific person.',
          },
          {
            title: 'How to avoid a random choice',
            text:
              'Start with the person: favorite color, home corner, occasion, or mood. Then browse the catalog, look at cartoons, or ask about availability, timing, and a close alternative.',
          },
        ],
        pathCards: [
          {
            title: 'Catalog of handmade pieces',
            text: 'Browse available toys, accessories, and decorations.',
            href: '/products',
          },
          {
            title: 'Personal cartoon',
            text: 'A more playful and personal gift connected to a specific person.',
            href: '/cartoons',
          },
          {
            title: 'Crochet toy as a gift',
            text: 'When you want something softer, more personal, and memorable.',
            href: '/gifts/handmade-crochet-toy-gift',
          },
        ],
        finalCta: {
          title: 'Choose a gift with a personal direction',
          text:
            'Browse available handmade pieces, view cartoons, or send the occasion, colors, and idea so the suggestion can be more precise.',
          actions: [
            link('/products', 'Browse catalog'),
            link('/cartoons', 'View cartoons'),
            link('/contacts', 'Send inquiry'),
          ],
        },
      },
    },
    common: {
      breadcrumbHome: 'Home',
      breadcrumbGifts: 'Gifts',
      backToHub: 'View all gifts',
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
    text: content.guides[slug].cardText || content.guides[slug].summary,
  }));
}

export function getGiftImagePlaceholderLabel(locale, subject, size) {
  if (locale === 'en') {
    return `${subject} image slot - ${size}`;
  }

  return `Място за изображение: ${subject} - ${size}`;
}
