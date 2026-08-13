export const aboutPageContent = {
  bg: {
    metadata: {
      title: {
        absolute: 'За Happy Colors | Хепи Колорс | Плетени играчки и декорация за дома',
      },
      description:
        'Научи повече за Happy Colors (Хепи Колорс) и за ръчно изработените плетени играчки, аксесоари и декорация за дома, създадени с внимание към детайла.',
    },
    hero: {
      imageAlt: 'Плетено лъвче, раничка и цветни прежди от Happy Colors',
      title:
        'Happy Colors - свят от ръчно изработени плетени играчки, аксесоари и декорации',
    },
    story: {
      title: 'Създадени с внимание, търпение и любов',
      paragraphs: [
        'Happy Colors се роди преди няколко години, когато открих, че плетенето на малки играчки и аксесоари ми носи спокойствие и радост. Постепенно това хоби се превърна в свят от ръчно изработени плетени играчки, аксесоари и красиви изделия с характер.',
        'Всяко изделие създавам с внимание към детайла, търпение и любов. За мен Happy Colors не е просто галерия, а малък свят, в който влагам сърце, вдъхновение и частица от себе си.',
      ],
    },
    linksIntro: {
      title: 'Открийте още',
      parts: [
        'Ако харесате конкретно изделие или имате идея за подарък, можете да разгледате ',
        { href: '/products', label: 'каталога' },
        ', да прочетете полезните ',
        { href: '/faq', label: 'отговори' },
        ' или да изпратите ',
        { href: '/contacts', label: 'запитване' },
        ' без ангажимент. Ако имате желание да изработя нещо специално за вас, не се колебайте да ме попитате чрез мейл или по телефона.',
      ],
    },
    highlights: {
      ariaLabel: 'Какво отличава Happy Colors',
      items: [
        'Ръчна изработка',
        'Внимание към детайла',
        'Меки цветове и характер',
        'Хипоалергенни материали',
        'Безопасни очички, нослета и др.',
        'Подарък за всеки повод',
      ],
    },
    usefulLinks: {
      ariaLabel: 'Полезни връзки',
      items: [
        {
          href: '/products',
          icon: 'gift',
          title: 'Галерията на Happy Colors',
          text: 'Разгледайте плетените играчки, аксесоари и декорации. Тези, които не са налични, могат да бъдат направени отново специално за вас.',
        },
        {
          href: '/faq',
          icon: 'question',
          title: 'Имате въпроси',
          text: 'Вижте повече за запитвания, материали, доставка и грижа за изделията.',
        },
        {
          href: '/contacts',
          icon: 'contact',
          title: 'Контакти',
          text: 'Изпратете запитване за конкретно изделие или индивидуална изработка.',
        },
      ],
      external: {
        href: 'https://webcreativeteam.com',
        icon: 'sparkles',
        title: 'webcreativeteam.com',
        text: 'Онлайн каталогът на Happy Colors е изработен от приятелите ни от Web Creative Team. Ако се нуждаете от надеждни специалисти, потърсете ги.',
      },
    },
    closing: {
      ariaLabel: 'Благодарност от Happy Colors',
      text: 'Благодаря ти, че си тук и отдели време да се докоснеш до света на Happy Colors.',
    },
  },
  en: {
    metadata: {
      title: {
        absolute: 'About Happy Colors | Crochet Toys and Handmade Decor',
      },
      description:
        'Learn more about Happy Colors and the handmade crochet toys, accessories, and home decorations created with care and attention to detail.',
    },
    hero: {
      imageAlt: 'Crocheted lion, small backpack, and colorful yarn from Happy Colors',
      title: 'Happy Colors - a world of handmade crochet toys, accessories, and decorations',
    },
    story: {
      title: 'Created with care, patience, and love',
      paragraphs: [
        'Happy Colors began a few years ago, when I discovered that crocheting small toys and accessories brought me calm and joy. Little by little, that hobby became a world of handmade crochet toys, accessories, and beautiful pieces with character.',
        'Every piece is made with attention to detail, patience, and love. To me, Happy Colors is not just a gallery, but a small world filled with heart, inspiration, and a little part of myself.',
      ],
    },
    linksIntro: {
      title: 'Discover more',
      parts: [
        'If you like a specific piece or have a gift idea, you can browse the ',
        { href: '/products', label: 'catalog' },
        ', read the helpful ',
        { href: '/faq', label: 'answers' },
        ', or send an ',
        { href: '/contacts', label: 'inquiry' },
        ' with no obligation. If you would like me to make something special for you, feel free to ask by email or phone.',
      ],
    },
    highlights: {
      ariaLabel: 'What makes Happy Colors special',
      items: [
        'Handmade work',
        'Attention to detail',
        'Soft colors and character',
        'Hypoallergenic materials',
        'Safety eyes, noses, and details',
        'A gift for every occasion',
      ],
    },
    usefulLinks: {
      ariaLabel: 'Helpful links',
      items: [
        {
          href: '/products',
          icon: 'gift',
          title: 'Happy Colors gallery',
          text: 'Browse crochet toys, accessories, and decorations. Pieces that are no longer available may be made again especially for you.',
        },
        {
          href: '/faq',
          icon: 'question',
          title: 'Have questions?',
          text: 'Learn more about inquiries, materials, delivery, and product care.',
        },
        {
          href: '/contacts',
          icon: 'contact',
          title: 'Contacts',
          text: 'Send an inquiry about a specific piece or a custom handmade request.',
        },
      ],
      external: {
        href: 'https://webcreativeteam.com',
        icon: 'sparkles',
        title: 'webcreativeteam.com',
        text: 'The Happy Colors online catalog was created by our friends at Web Creative Team. If you need reliable specialists, you can contact them.',
      },
    },
    closing: {
      ariaLabel: 'A thank-you from Happy Colors',
      text: 'Thank you for being here and taking the time to step into the world of Happy Colors.',
    },
  },
};

export function getAboutPageContent(locale = 'bg') {
  return aboutPageContent[locale] || aboutPageContent.bg;
}
