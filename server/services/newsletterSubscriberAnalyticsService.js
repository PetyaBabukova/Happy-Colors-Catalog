import NewsletterSubscriber from '../models/NewsletterSubscriber.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const NEW_SUBSCRIBER_BADGE_DAYS = 30;

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.floor(parsed));
}

export function normalizeSubscriberAnalyticsQuery(query = {}) {
  const page = parsePositiveInteger(query.page, DEFAULT_PAGE);
  const requestedPageSize = parsePositiveInteger(query.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  return { page, pageSize };
}

function dateOrNull(value) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null;
}

function getFirstSubscribedAt(subscriber) {
  return dateOrNull(subscriber.firstSubscribedAt) || dateOrNull(subscriber.createdAt) || dateOrNull(subscriber.consentGivenAt);
}

export function getSubscriberBadge(subscriber, now = new Date()) {
  if (subscriber.status === 'unsubscribed') {
    return 'unsubscribed';
  }

  const firstSubscribedAt = getFirstSubscribedAt(subscriber);
  const subscribeCount = Math.max(1, Number(subscriber.subscribeCount || 1));
  const hasEverUnsubscribed = Boolean(subscriber.hasEverUnsubscribed);
  const newWindowStartedAt = new Date(now.getTime() - NEW_SUBSCRIBER_BADGE_DAYS * 24 * 60 * 60 * 1000);

  if (
    subscriber.status === 'active' &&
    subscribeCount === 1 &&
    !hasEverUnsubscribed &&
    firstSubscribedAt &&
    firstSubscribedAt >= newWindowStartedAt
  ) {
    return 'new';
  }

  if (subscriber.status === 'active' && (subscribeCount > 1 || hasEverUnsubscribed)) {
    return 'subscribed';
  }

  return null;
}

function serializeSubscriber(subscriber, now) {
  return {
    id: String(subscriber._id),
    email: subscriber.email,
    status: subscriber.status,
    badge: getSubscriberBadge(subscriber, now),
    firstSubscribedAt: getFirstSubscribedAt(subscriber)?.toISOString() || null,
    lastSubscribedAt: dateOrNull(subscriber.lastSubscribedAt)?.toISOString() || null,
    consentGivenAt: dateOrNull(subscriber.consentGivenAt)?.toISOString() || null,
    unsubscribedAt: dateOrNull(subscriber.unsubscribedAt)?.toISOString() || null,
    welcomeEmailSentAt: dateOrNull(subscriber.welcomeEmailSentAt)?.toISOString() || null,
    subscribeCount: Math.max(1, Number(subscriber.subscribeCount || 1)),
    hasEverUnsubscribed: Boolean(subscriber.hasEverUnsubscribed),
  };
}

const emptySummary = {
  total: 0,
  active: 0,
  unsubscribed: 0,
  new: 0,
  resubscribed: 0,
};

async function getSubscriberSummary(now) {
  const newWindowStartedAt = new Date(now.getTime() - NEW_SUBSCRIBER_BADGE_DAYS * 24 * 60 * 60 * 1000);
  const [summary] = await NewsletterSubscriber.aggregate([
    {
      $addFields: {
        effectiveFirstSubscribedAt: {
          $ifNull: ['$firstSubscribedAt', { $ifNull: ['$createdAt', '$consentGivenAt'] }],
        },
        effectiveSubscribeCount: {
          $ifNull: ['$subscribeCount', 1],
        },
        effectiveHasEverUnsubscribed: {
          $ifNull: ['$hasEverUnsubscribed', false],
        },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: {
            $cond: [{ $eq: ['$status', 'active'] }, 1, 0],
          },
        },
        unsubscribed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'unsubscribed'] }, 1, 0],
          },
        },
        new: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'active'] },
                  { $lte: ['$effectiveSubscribeCount', 1] },
                  { $eq: ['$effectiveHasEverUnsubscribed', false] },
                  { $gte: ['$effectiveFirstSubscribedAt', newWindowStartedAt] },
                ],
              },
              1,
              0,
            ],
          },
        },
        resubscribed: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'active'] },
                  {
                    $or: [
                      { $gt: ['$effectiveSubscribeCount', 1] },
                      { $eq: ['$effectiveHasEverUnsubscribed', true] },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $project: { _id: 0, total: 1, active: 1, unsubscribed: 1, new: 1, resubscribed: 1 } },
  ]);

  return { ...emptySummary, ...(summary || {}) };
}

function getPagePipeline(page, pageSize) {
  return [
    {
      $addFields: {
        sortAt: {
          $ifNull: ['$lastStatusChangedAt', { $ifNull: ['$createdAt', { $ifNull: ['$consentGivenAt', new Date(0)] }] }],
        },
      },
    },
    { $sort: { sortAt: -1, _id: -1 } },
    { $skip: (page - 1) * pageSize },
    { $limit: pageSize },
  ];
}

export async function getNewsletterSubscriberAnalytics(query = {}) {
  const { page, pageSize } = normalizeSubscriberAnalyticsQuery(query);
  const now = new Date();
  const [summary, pageSubscribers] = await Promise.all([
    getSubscriberSummary(now),
    NewsletterSubscriber.aggregate(getPagePipeline(page, pageSize)),
  ]);
  const totalPages = Math.max(1, Math.ceil(summary.total / pageSize));

  return {
    summary,
    pagination: {
      page,
      pageSize,
      totalPages,
    },
    subscribers: pageSubscribers.map((subscriber) => serializeSubscriber(subscriber, now)),
  };
}
