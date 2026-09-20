export const homePageContent = {
  bg: {
    metadata: {
      title: {
        absolute: 'Ръчно изработени подаръци, плетени играчки и декорация | Happy Colors',
      },
      description:
        'Ръчно изработени подаръци от Happy Colors - плетени играчки, handmade изделия, аксесоари и декорация за дома с характер.',
    },
    intro: {
      title: 'Ръчно изработени плетени играчки, аксесоари и декорация за дома',
      text: 'В Happy Colors ще откриете ръчно изработени подаръци, плетени играчки, аксесоари и декорация за дома, създадени с внимание към всеки детайл. Колекцията включва красиви и оригинални ръчно изработени изделия, подходящи за подарък, детска стая, празник или уютен акцент у дома. Ако търсите оригинални подаръци с характер или нещо специално, изработено на ръка, разгледайте нашите handmade предложения. Ако нещо ви хареса, можете да се свържете с мен за наличност, въпроси и поръчка.',
    },
    favoritesTitle: 'Най-любимите ви продукти',
    giftIdeas: {
      title: 'Идеи за подарък',
      intro:
        'Няколко кратки посоки, ако търсите ръчно изработен подарък за дете, специален повод или човек, който обича цветни handmade изделия.',
      cards: [
        {
          title: 'Подаръци за деца',
          text: 'Плетени играчки, цветни герои и оригинални идеи за различни поводи. Аксесоари и декорации за детската стая, малки изненади за празник и подаръци, които внасят цвят в ежедневието и остават мил спомен.',
          href: '/gifts/gifts-for-children',
        },
        {
          title: 'Плетената играчка като подарък',
          text: 'Мил и запомнящ се избор, който носи топлина и насърчава детското въображение и творческата игра. Подарявате не просто играчка, а любим плюшен приятел, който може да е част от безброй игри и приключения.',
          href: '/gifts/handmade-crochet-toy-gift',
        },
        {
          title: 'Оригинални handmade подаръци',
          text: 'Всеки handmade подарък има свой характер и носи частица лично отношение. Подходящ избор, когато търсите нещо различно, красиво и създадено специално, а не просто поредния подарък.',
          href: '/gifts/original-handmade-gift',
        },
      ],
      hubCta: 'Всички идеи за подарък',
    },
    faqLinkLabel: 'Често задавани въпроси',
  },
  en: {
    metadata: {
      title: {
        absolute: 'Handmade Crochet Toys, Gifts & Home Decor | Happy Colors',
      },
      description:
        'Unique handmade gifts from Happy Colors: crochet toys, crochet gifts, accessories, bags and handmade home decor for colorful everyday moments.',
    },
    intro: {
      title: 'Handmade crochet toys, accessories, and home decor',
      text: 'At Happy Colors, you’ll find unique handmade gifts created with care and attention to every detail. Discover handmade crochet toys, accessories, bags and handmade home decor designed for birthdays, special occasions, children’s rooms or simply to bring a little more color into everyday life. Our collection includes original crochet gifts and handmade crochet pieces, each with its own character and charm. Browse the collection and find something special for someone you love – or for yourself.',
    },
    favoritesTitle: 'Your favorite products',
    giftIdeas: {
      title: 'Gift ideas',
      intro:
        'A few calm starting points when you are looking for a handmade gift for a child, a special occasion, or someone who loves colorful handmade pieces.',
      cards: [
        {
          title: 'Gifts for children',
          text: 'Crochet toys, colorful characters, and original gift ideas for different occasions. Accessories and decorations for a child’s room, little surprises for special celebrations, and gifts that bring color to everyday life and become cherished keepsakes.',
          href: '/gifts/gifts-for-children',
        },
        {
          title: 'Crochet toy as a gift',
          text: 'A sweet and memorable choice that brings warmth and encourages a child’s imagination and creative play. You’re giving more than just a toy – you’re giving a favorite cuddly friend who can become part of countless games and adventures.',
          href: '/gifts/handmade-crochet-toy-gift',
        },
        {
          title: 'Original handmade gift',
          text: 'Every handmade gift has its own character and carries a personal touch. A perfect choice when you’re looking for something different, beautiful, and specially made – not just another ordinary gift.',
          href: '/gifts/original-handmade-gift',
        },
      ],
      hubCta: 'All gift ideas',
    },
    faqLinkLabel: 'Frequently asked questions',
  },
};

export function getHomePageContent(locale = 'bg') {
  return homePageContent[locale] || homePageContent.bg;
}
