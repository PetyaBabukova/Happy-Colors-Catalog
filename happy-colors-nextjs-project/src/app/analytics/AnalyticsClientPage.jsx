'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Clock,
  Eye,
  MailCheck,
  RefreshCw,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import MessageBox from '@/components/ui/MessageBox';
import { useAuth } from '@/context/AuthContext';
import {
  fetchAnalyticsSummary,
  fetchNewsletterSubscriberAnalytics,
} from '@/managers/analyticsManager';
import styles from './analytics.module.css';

function formatNumber(value) {
  return new Intl.NumberFormat('bg-BG').format(Number(value || 0));
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  const minutes = Math.floor(totalSeconds / 60);
  const restSeconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${restSeconds} сек`;
  }

  return `${minutes} мин ${restSeconds} сек`;
}

function formatPercent(value) {
  return `${new Intl.NumberFormat('bg-BG', {
    maximumFractionDigits: 1,
  }).format(Number(value || 0))}%`;
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('bg-BG', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDeviceCategory(value) {
  const labels = {
    desktop: 'Компютър',
    mobile: 'Мобилно',
    tablet: 'Таблет',
    smarttv: 'Smart TV',
  };

  return labels[String(value || '').toLowerCase()] || value || 'Неизвестно';
}

function formatBadge(value) {
  const labels = {
    new: 'Нов',
    subscribed: 'Абониран',
    unsubscribed: 'Отписан',
  };

  return labels[value] || '';
}

function formatSubscriberStatus(value) {
  return value === 'unsubscribed' ? 'Отписан' : 'Активен';
}

function MetricCard({ icon: Icon, label, value, detail }) {
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricIcon}>
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <p className={styles.metricLabel}>{label}</p>
        <p className={styles.metricValue}>{value}</p>
        {detail ? <p className={styles.metricDetail}>{detail}</p> : null}
      </div>
    </article>
  );
}

function PeriodCard({ period }) {
  return (
    <article className={styles.periodCard}>
      <h2>{period.label}</h2>
      <div className={styles.periodMetrics}>
        <MetricCard
          icon={Users}
          label="Потребители"
          value={formatNumber(period.activeUsers)}
          detail="активни потребители"
        />
        <MetricCard
          icon={Eye}
          label="Преглеждания"
          value={formatNumber(period.pageViews)}
          detail={`${formatNumber(period.sessions)} сесии`}
        />
        <MetricCard
          icon={Clock}
          label="Ангажираност"
          value={formatDuration(period.averageEngagementSeconds)}
          detail="средно на потребител"
        />
      </div>
    </article>
  );
}

function SubscriberAnalyticsSection({ analytics }) {
  if (!analytics) {
    return null;
  }

  return (
    <>
      <section className={styles.subscriberSummary} aria-label="Абонати за бюлетина">
        <MetricCard
          icon={MailCheck}
          label="Абонати"
          value={formatNumber(analytics.summary?.active)}
          detail={`${formatNumber(analytics.summary?.total)} общо`}
        />
        <MetricCard
          icon={UserPlus}
          label="Нови"
          value={formatNumber(analytics.summary?.new)}
          detail="последните 30 дни"
        />
        <MetricCard
          icon={UserX}
          label="Отписани"
          value={formatNumber(analytics.summary?.unsubscribed)}
          detail={`${formatNumber(analytics.summary?.resubscribed)} повторно абонирани`}
        />
      </section>

      <section className={styles.subscriberPanel}>
        <h2>Абонати</h2>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Статус</th>
                <th>Етикет</th>
                <th>Първо абониране</th>
                <th>Последно абониране</th>
                <th>Отписване</th>
                <th>Welcome email</th>
              </tr>
            </thead>
            <tbody>
              {(analytics.subscribers || []).map((subscriber) => (
                <tr key={subscriber.id}>
                  <td>
                    <span className={styles.primaryCell}>{subscriber.email}</span>
                  </td>
                  <td>{formatSubscriberStatus(subscriber.status)}</td>
                  <td>
                    {subscriber.badge ? (
                      <span className={`${styles.badge} ${styles[`badge_${subscriber.badge}`] || ''}`}>
                        {formatBadge(subscriber.badge)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{formatDateTime(subscriber.firstSubscribedAt)}</td>
                  <td>{formatDateTime(subscriber.lastSubscribedAt)}</td>
                  <td>{formatDateTime(subscriber.unsubscribedAt)}</td>
                  <td>{formatDateTime(subscriber.welcomeEmailSentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {analytics.subscribers?.length ? null : (
          <p className={styles.emptyText}>Все още няма абонати за бюлетина.</p>
        )}
      </section>
    </>
  );
}

export default function AnalyticsClientPage() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState(null);
  const [subscriberAnalytics, setSubscriberAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [subscriberError, setSubscriberError] = useState('');

  const isFullAdmin = user?.role === 'full_admin';

  const loadSummary = useCallback(
    async ({ refresh = false } = {}) => {
      if (!isFullAdmin) {
        return;
      }

      setError('');
      setSubscriberError('');
      setLoading(!refresh);
      setRefreshing(refresh);

      const summaryRequest = fetchAnalyticsSummary({ refresh })
        .then((value) => {
          setSummary(value);
        })
        .catch((reason) => {
          setError(reason?.message || 'Неуспешно зареждане на аналитичните данни.');
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });

      const subscriberRequest = fetchNewsletterSubscriberAnalytics()
        .then((value) => {
          setSubscriberAnalytics(value);
        })
        .catch((reason) => {
          setSubscriberError(reason?.message || 'Неуспешно зареждане на данните за абонати.');
        });

      await Promise.allSettled([summaryRequest, subscriberRequest]);
    },
    [isFullAdmin]
  );

  useEffect(() => {
    if (!authLoading) {
      loadSummary();
    }
  }, [authLoading, loadSummary]);

  const cacheMinutes = useMemo(() => {
    const seconds = Number(summary?.cacheTtlSeconds || 0);

    return seconds ? Math.round(seconds / 60) : 0;
  }, [summary]);

  if (authLoading) {
    return <p className="pageInline">Зареждане...</p>;
  }

  if (!isFullAdmin) {
    return (
      <MessageBox
        type="error"
        message="Тази страница е достъпна само за full admin потребители."
      />
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Анализи</h1>
          <p>
            Обобщени данни от Google Analytics. Данните са кеширани за кратко, за да не
            правим заявка към Google при всяко отваряне.
          </p>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => loadSummary({ refresh: true })}
          disabled={loading || refreshing}
        >
          <RefreshCw size={18} aria-hidden="true" />
          {refreshing ? 'Обновяване...' : 'Обнови'}
        </button>
      </header>

      {error ? <MessageBox type="error" message={error} /> : null}
      {subscriberError ? <MessageBox type="error" message={subscriberError} /> : null}

      {loading && !summary ? (
        <p className={styles.statusText}>Зареждане на аналитичните данни...</p>
      ) : null}

      {summary && !summary.configured ? (
        <section className={styles.setupPanel}>
          <BarChart3 size={28} aria-hidden="true" />
          <div>
            <h2 className={styles.setupTitle}>Google Analytics API не е конфигуриран</h2>
            <p>
              Tracking tag-ът може да събира данни, но за вътрешния dashboard са нужни
              server-side настройки: GA4 Property ID и OAuth credentials.
            </p>
          </div>
        </section>
      ) : null}

      {summary?.configured ? (
        <>
          <section className={styles.summaryStrip}>
            <MetricCard
              icon={Activity}
              label="В момента"
              value={formatNumber(summary.realtime?.activeUsers)}
              detail="активни потребители"
            />
            <MetricCard
              icon={RefreshCw}
              label="Обновено"
              value={formatDateTime(summary.generatedAt)}
              detail={summary.cached ? `от кеша (${cacheMinutes} мин)` : `нови данни (${cacheMinutes} мин кеш)`}
            />
          </section>

          <section className={styles.periodGrid} aria-label="Периоди">
            {(summary.periods || []).map((period) => (
              <PeriodCard key={period.label} period={period} />
            ))}
          </section>

          <section className={styles.tablesGrid}>
            <article className={styles.tablePanel}>
              <h2>Топ страници за 30 дни</h2>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Страница</th>
                      <th>Преглеждания</th>
                      <th>Потребители</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary.topPages || []).map((page, index) => (
                      <tr key={`${page.path}-${page.title}-${index}`}>
                        <td>
                          <span className={styles.primaryCell}>{page.title}</span>
                          <span className={styles.secondaryCell}>{page.path}</span>
                        </td>
                        <td>{formatNumber(page.pageViews)}</td>
                        <td>{formatNumber(page.activeUsers)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {summary.topPages?.length ? null : (
                <p className={styles.emptyText}>Все още няма данни за страници.</p>
              )}
            </article>

            <div className={styles.sidePanels}>
              <article className={`${styles.tablePanel} ${styles.compactTablePanel}`}>
                <h2>Източници за 30 дни</h2>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Канал</th>
                        <th>Сесии</th>
                        <th>Потребители</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(summary.trafficSources || []).map((source, index) => (
                        <tr key={`${source.source}-${index}`}>
                          <td>{source.source}</td>
                          <td>{formatNumber(source.sessions)}</td>
                          <td>{formatNumber(source.activeUsers)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {summary.trafficSources?.length ? null : (
                  <p className={styles.emptyText}>Все още няма данни за източници.</p>
                )}
              </article>

              <article className={`${styles.tablePanel} ${styles.compactTablePanel}`}>
                <h2>Устройства за 30 дни</h2>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Устройство</th>
                        <th>Сесии</th>
                        <th>Потребители</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(summary.devices || []).map((device, index) => (
                        <tr key={`${device.category}-${index}`}>
                          <td>{formatDeviceCategory(device.category)}</td>
                          <td>{formatNumber(device.sessions)}</td>
                          <td>{formatNumber(device.activeUsers)}</td>
                          <td>{formatPercent(device.percent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {summary.devices?.length ? null : (
                  <p className={styles.emptyText}>Все още няма данни за устройства.</p>
                )}
              </article>
            </div>
          </section>
        </>
      ) : null}

      <SubscriberAnalyticsSection analytics={subscriberAnalytics} />
    </main>
  );
}
