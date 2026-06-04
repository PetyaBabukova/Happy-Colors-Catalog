import { fileURLToPath } from 'url';
import mongoose from '../server/mongoose.js';
import NewsletterSubscriber from '../server/models/NewsletterSubscriber.js';
import { getLegacyReactivationHeuristic } from '../server/services/newsletterService.js';

function dateOrNull(value) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null;
}

function buildLifecyclePatch(subscriber) {
  const createdAt = dateOrNull(subscriber.createdAt);
  const consentGivenAt = dateOrNull(subscriber.consentGivenAt);
  const unsubscribedAt = dateOrNull(subscriber.unsubscribedAt);
  const updatedAt = dateOrNull(subscriber.updatedAt);
  const firstSubscribedAt = dateOrNull(subscriber.firstSubscribedAt) || createdAt || consentGivenAt;
  const lastSubscribedAt = dateOrNull(subscriber.lastSubscribedAt) || consentGivenAt || createdAt;
  const confirmedAt = dateOrNull(subscriber.confirmedAt) || consentGivenAt || firstSubscribedAt || createdAt;
  const subscribeCount = Math.max(1, Number(subscriber.subscribeCount || 1));
  const hasEverUnsubscribed =
    Boolean(subscriber.hasEverUnsubscribed) ||
    subscriber.status === 'unsubscribed' ||
    Boolean(unsubscribedAt) ||
    getLegacyReactivationHeuristic(firstSubscribedAt, consentGivenAt);
  const lastStatusChangedAt =
    dateOrNull(subscriber.lastStatusChangedAt) ||
    unsubscribedAt ||
    consentGivenAt ||
    updatedAt ||
    createdAt;

  return {
    firstSubscribedAt,
    lastSubscribedAt,
    confirmedAt,
    subscribeCount,
    hasEverUnsubscribed,
    lastStatusChangedAt,
  };
}

export async function backfillNewsletterSubscriberLifecycle() {
  const subscribers = await NewsletterSubscriber.find({}).select(
    'status consentGivenAt confirmedAt firstSubscribedAt lastSubscribedAt subscribeCount hasEverUnsubscribed lastStatusChangedAt unsubscribedAt createdAt updatedAt'
  );
  let modifiedCount = 0;

  for (const subscriber of subscribers) {
    const patch = buildLifecyclePatch(subscriber);

    subscriber.firstSubscribedAt = patch.firstSubscribedAt;
    subscriber.lastSubscribedAt = patch.lastSubscribedAt;
    subscriber.confirmedAt = patch.confirmedAt;
    subscriber.subscribeCount = patch.subscribeCount;
    subscriber.hasEverUnsubscribed = patch.hasEverUnsubscribed;
    subscriber.lastStatusChangedAt = patch.lastStatusChangedAt;
    await subscriber.save();
    modifiedCount += 1;
  }

  return {
    matchedCount: subscribers.length,
    modifiedCount,
  };
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const result = await backfillNewsletterSubscriberLifecycle();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
