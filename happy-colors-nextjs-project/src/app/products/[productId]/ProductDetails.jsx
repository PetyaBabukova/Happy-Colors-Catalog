// happy-colors-nextjs-project/src/app/products/[productId]/ProductDetails.jsx

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { isOwner } from '@/utils/isOwner';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { isCatalogMode } from '@/utils/catalogMode';
import Image from 'next/image';
import useImageSlideshow from '@/hooks/useImageSlideshow';
import { normalizeImageUrls } from '@/utils/normalizeImageUrls';
import { normalizeProductVideosForSeo } from '@/utils/productSeo';
import MessageBox from '@/components/ui/MessageBox';
import { approveAdminProduct, rejectAdminProduct } from '@/managers/usersAdminManager';
import TranslationDecisionModal from '@/components/translations/TranslationDecisionModal';
import { acceptCurrentTranslation, generateTranslation } from '@/managers/translationsManager';
import { isCartoonsServiceContext } from '@/config/cartoonsFeature';
import { buildCartoonServiceContactHref } from '@/utils/cartoonServiceRoutes';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import useTranslations from '@/i18n/useTranslations';
import styles from './details.module.css';

function warnAutoplay(message, details = {}) {
	if (process.env.NODE_ENV !== 'development') {
		return;
	}

	console.warn(message, details);
}

function normalizeProductVideos(videos) {
	return normalizeProductVideosForSeo(videos).map((video, index) => ({
		...video,
		type: 'video',
		key: `video-${video.url}-${index}`,
	}));
}

function buildMediaSlides(imageUrls, videos) {
	const imageSlides = imageUrls.map((url, index) => ({
		type: 'image',
		key: `image-${url}-${index}`,
		url,
	}));

	return [...imageSlides, ...videos];
}

// TODO: Ще се активира при имплементация на ревю система
// function EmptyStarIcon() {
// 	return (
// 		<svg viewBox="0 0 24 24" aria-hidden="true" className={styles.starIcon}>
// 			<path d="M12 3.2l2.68 5.44 6 .88-4.34 4.23 1.02 5.97L12 16.9l-5.36 2.82 1.02-5.97L3.32 9.52l6-.88Z"
// 				fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
// 		</svg>
// 	);
// }

export default function ProductDetails({ product, serviceContext = '' }) {
	const { user } = useAuth();
	const { addToCart } = useCart();
	const { publicHref } = useLocaleNavigation();
	const { t } = useTranslations();
	const isFullAdmin = user?.role === 'full_admin';
	const isCartoonServiceContext = isCartoonsServiceContext(serviceContext);
	const canEdit = isFullAdmin || isOwner(product, user);
	const isPendingReview = product?.publicationStatus === 'pending_review' || product?.reviewStatus === 'pending_review';
	const isTranslationPending = product?.translationPending && product?.contentLocale === 'bg';
	const productLanguage = isTranslationPending ? 'bg' : undefined;
	const router = useRouter();
	const gestureRef = useRef(null);
	const videoRefs = useRef(new Map());
	const resumeAfterVideoRef = useRef(false);
	const activeSlideKeyRef = useRef('');
	const pointerIdRef = useRef(null);
	const dragStartXRef = useRef(0);

	const imageUrls = useMemo(() => normalizeImageUrls(product), [product]);
	const videos = useMemo(() => normalizeProductVideos(product?.videos), [product?.videos]);
	const mediaSlides = useMemo(() => buildMediaSlides(imageUrls, videos), [imageUrls, videos]);
	const loopedMediaSlides = useMemo(() => {
		if (mediaSlides.length <= 1) {
			return mediaSlides;
		}

		return [mediaSlides[mediaSlides.length - 1], ...mediaSlides, mediaSlides[0]];
	}, [mediaSlides]);
	const [activeTab, setActiveTab] = useState('description');
	const [createdReviewNotice, setCreatedReviewNotice] = useState(false);
	const [updatedReviewNotice, setUpdatedReviewNotice] = useState(false);
	const [reviewActionLoading, setReviewActionLoading] = useState('');
	const [reviewActionError, setReviewActionError] = useState('');
	const [translationDecision, setTranslationDecision] = useState(null);
	const [translationDecisionLoading, setTranslationDecisionLoading] = useState('');
	const [translationDecisionError, setTranslationDecisionError] = useState('');
	const [isDragging, setIsDragging] = useState(false);
	const [dragOffset, setDragOffset] = useState(0);
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
	const {
		currentIndex,
		hasMultiple,
		trackIndex,
		transitionEnabled,
		showPrev,
		showNext,
		pause,
		resume,
		handleTrackTransitionEnd,
	} = useImageSlideshow(
		mediaSlides,
		5000,
		{ resetKey: product._id }
	);
	const activeSlide = mediaSlides[currentIndex];

	useEffect(() => {
		activeSlideKeyRef.current = activeSlide?.key || '';
	}, [activeSlide?.key]);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

		handleChange();
		mediaQuery.addEventListener?.('change', handleChange);

		return () => {
			mediaQuery.removeEventListener?.('change', handleChange);
		};
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		setCreatedReviewNotice(
			new URLSearchParams(window.location.search).get('created') === 'review-pending'
		);
		setUpdatedReviewNotice(
			new URLSearchParams(window.location.search).get('updated') === 'review-pending'
		);
	}, []);

	useEffect(() => {
		if (activeSlide?.type === 'video') {
			resumeAfterVideoRef.current = true;
			pause();
			return;
		}

		videoRefs.current.forEach((video) => {
			video.pause();
			video.currentTime = 0;
		});

		if (resumeAfterVideoRef.current) {
			resumeAfterVideoRef.current = false;
			resume();
		}
	}, [activeSlide?.key, activeSlide?.type, pause, resume]);

	useEffect(() => {
		if (activeSlide?.type !== 'video') {
			return;
		}

		const video = videoRefs.current.get(activeSlide.key);

		if (!video) {
			warnAutoplay('PDP autoplay: active slide video is not mounted yet.', {
				slideKey: activeSlide.key,
			});
			return;
		}

		if (prefersReducedMotion) {
			video.pause();
			return;
		}

		if (video.readyState >= 2) {
			tryAutoplayVideo(activeSlide.key);
			return;
		}

		const handleLoadedData = () => {
			if (activeSlideKeyRef.current !== activeSlide.key) {
				return;
			}

			tryAutoplayVideo(activeSlide.key);
		};

		video.addEventListener('loadeddata', handleLoadedData);

		if (video.readyState >= 2) {
			handleLoadedData();
		}

		return () => {
			video.pause();
			video.removeEventListener('loadeddata', handleLoadedData);
		};
	}, [activeSlide?.key, activeSlide?.type, prefersReducedMotion]);

	const isAvailable = product?.availability !== 'unavailable';
	const shouldUseInquiryAction = isCartoonServiceContext || isCatalogMode || !isAvailable;

	const availabilityLabel = isAvailable
		? t('products.availableCatalog')
		: t('products.unavailableCatalog');
	const cartoonAvailabilityLabel = t('products.cartoonAvailability');

	const handleAddToCart = () => {
		addToCart({
			_id: product._id,
			title: product.title,
			price: product.price,
			image: activeSlide?.type === 'image'
				? activeSlide.url
				: imageUrls[0] || videos[0]?.posterUrl || product.imageUrl || '',
		});

		router.push(publicHref('/cart'));
	};

	const tryAutoplayVideo = (slideKey) => {
		if (prefersReducedMotion) {
			return;
		}

		if (activeSlideKeyRef.current !== slideKey) {
			warnAutoplay('PDP autoplay: stale slide key skipped.', {
				requestedSlideKey: slideKey,
				activeSlideKey: activeSlideKeyRef.current,
			});
			return;
		}

		const video = videoRefs.current.get(slideKey);

		if (!video) {
			warnAutoplay('PDP autoplay: missing video element for slide.', { slideKey });
			return;
		}

		if (video.readyState < 2) {
			warnAutoplay('PDP autoplay: waiting for video data before play.', {
				slideKey,
				readyState: video.readyState,
			});
			return;
		}

		video.muted = true;

		const playPromise = video.play();

		if (playPromise?.catch) {
			playPromise.catch((error) => {
				warnAutoplay('PDP autoplay was blocked or interrupted.', {
					slideKey,
					error,
				});
			});
		}
	};

	const setVideoRef = (key, node) => {
		if (node) {
			videoRefs.current.set(key, node);

			// This helps when the active slide's video mounts lazily after enough data is already buffered.
			if (
				key === activeSlideKeyRef.current &&
				node.readyState >= 2 &&
				!prefersReducedMotion
			) {
				tryAutoplayVideo(key);
			}
			return;
		}

		videoRefs.current.delete(key);
	};

	const handleVideoEnded = () => {
		showNext();
	};

	const handleInquiry = () => {
		if (isCartoonServiceContext) {
			router.push(publicHref(buildCartoonServiceContactHref({ productId: product._id })));
			return;
		}

		router.push(publicHref(`/contacts?productId=${product._id}`));
	};

	const handleApproveProduct = async () => {
		setReviewActionLoading('approve');
		setReviewActionError('');
		setTranslationDecisionError('');

		try {
			const updated = await approveAdminProduct(product._id);
			if (updated?.englishTranslationDecision) {
				setTranslationDecision({
					...updated.englishTranslationDecision,
					entityType: 'product',
					entityId: product._id,
				});
				return;
			}
			router.refresh();
		} catch (error) {
			setReviewActionError(error.message || t('products.approveError'));
		} finally {
			setReviewActionLoading('');
		}
	};

	const handleTranslationDecision = async (action) => {
		if (!translationDecision) {
			return;
		}

		setTranslationDecisionLoading(action);
		setTranslationDecisionError('');

		const payload = {
			entityType: translationDecision.entityType,
			entityId: translationDecision.entityId,
			locale: translationDecision.locale,
			expectedSourceRevision: translationDecision.sourceRevision,
			expectedTranslationRevision: translationDecision.translationRevision || 0,
		};

		try {
			if (action === 'yes') {
				await generateTranslation(payload);
			} else {
				await acceptCurrentTranslation(payload);
			}

			setTranslationDecision(null);
			router.refresh();
		} catch (error) {
			setTranslationDecisionError(error.message || 'English translation decision was not saved.');
		} finally {
			setTranslationDecisionLoading('');
		}
	};

	const handleRejectProduct = async () => {
		const reviewNote = window.prompt(t('products.rejectPrompt'));

		if (!reviewNote || reviewNote.trim() === '') {
			setReviewActionError(t('products.rejectRequired'));
			return;
		}

		setReviewActionLoading('reject');
		setReviewActionError('');

		try {
			await rejectAdminProduct(product._id, reviewNote);
			router.refresh();
		} catch (error) {
			setReviewActionError(error.message || t('products.rejectError'));
		} finally {
			setReviewActionLoading('');
		}
	};

	const handlePointerDown = (event) => {
		if (!hasMultiple || event.target.closest('button, video')) {
			return;
		}

		pointerIdRef.current = event.pointerId;
		dragStartXRef.current = event.clientX;
		setDragOffset(0);
		setIsDragging(true);
		pause();
		event.currentTarget.setPointerCapture?.(event.pointerId);
	};

	const handlePointerMove = (event) => {
		if (!isDragging || pointerIdRef.current !== event.pointerId) {
			return;
		}

		setDragOffset(event.clientX - dragStartXRef.current);
	};

	const finishDrag = (event) => {
		if (!isDragging || pointerIdRef.current !== event.pointerId) {
			return;
		}

		const containerWidth = gestureRef.current?.offsetWidth || 0;
		const threshold = Math.max(50, containerWidth * 0.15);
		const deltaX = event.clientX - dragStartXRef.current;

		if (deltaX <= -threshold) {
			showNext();
		} else if (deltaX >= threshold) {
			showPrev();
		}

		setIsDragging(false);
		setDragOffset(0);
		pointerIdRef.current = null;
		event.currentTarget.releasePointerCapture?.(event.pointerId);
		if (activeSlide?.type !== 'video') {
			resume();
		}
	};

	return (
		<section className={styles.productDetails}>
			<TranslationDecisionModal
				decision={translationDecision}
				entityLabel="product"
				busyAction={translationDecisionLoading}
				error={translationDecisionError}
				onYes={() => handleTranslationDecision('yes')}
				onNo={() => handleTranslationDecision('no')}
				onDismiss={() => {
					setTranslationDecision(null);
					router.refresh();
				}}
			/>
			<div className={styles.productDescriptionContainer}>
				{createdReviewNotice && (
					<MessageBox
						type="success"
						message={t('products.createdReviewNotice')}
					/>
				)}
				{updatedReviewNotice && (
					<MessageBox
						type="success"
						message={t('products.updatedReviewNotice')}
					/>
				)}
				{product.publicationStatus === 'pending_review' && !createdReviewNotice && (
					<MessageBox
						type="success"
						message={t('products.pendingReviewNotice')}
					/>
				)}
				{isPendingReview && isFullAdmin && (
					<MessageBox
						type="success"
						message={t('products.adminReviewNotice')}
					/>
				)}
				{reviewActionError && (
					<MessageBox type="error" message={reviewActionError} />
				)}
				{isTranslationPending && (
					<MessageBox type="success" message={t('products.translationPending')} />
				)}
				<h1 lang={productLanguage}>{product.title}</h1>

				{/* TODO: Рейтинг звездички — ще се активират при имплементация на ревю система
				<div className={styles.reviewContainer}>
					<div className={styles.starsEmpty}>
						{[...Array(5)].map((_, i) => (
							<EmptyStarIcon key={i} />
						))}
					</div>
				</div>
				*/}

				<ul className={styles.productDetailsBodyTabsContainer}>
					<li
						className={`${styles.productDetailsBodyTab} ${
							activeTab === 'description' ? styles.activeTab : ''
						}`}
					>
						<a
							href="#"
							onClick={(e) => {
								e.preventDefault();
								setActiveTab('description');
							}}
						>
							{t('products.descriptionTab')}
						</a>
					</li>

					{!isCatalogMode && (
						<li
							className={`${styles.productDetailsBodyTab} ${
								activeTab === 'delivery' ? styles.activeTab : ''
							}`}
						>
							<a
								href="#"
								onClick={(e) => {
									e.preventDefault();
									setActiveTab('delivery');
								}}
							>
								{t('products.deliveryTab')}
							</a>
						</li>
					)}
				</ul>

				<div className={styles.productDescriptionBody}>
					{activeTab === 'description' && (
						<p lang={productLanguage}>{product.description}</p>
					)}

					{!isCatalogMode && activeTab === 'delivery' && (
						<p style={{ whiteSpace: 'pre-line' }}>{t('products.deliveryContent')}</p>
					)}
				</div>

				{activeTab === 'description' && (
					<>
						<p className={isAvailable ? styles.available : styles.unavailable}>
							<b>{t('products.availabilityLabel')}</b> {isCartoonServiceContext ? cartoonAvailabilityLabel : availabilityLabel}
						</p>

						{isCartoonServiceContext ? (
							<p className={styles.cartoonPriceNote}>
								{t('products.cartoonPriceIntro', { price: product.price })}
								<br />
								{t('products.cartoonPriceDetails')}{' '}
								<Link href={publicHref('/cartoons/offer')} className={styles.cartoonOfferLink}>
									{t('products.cartoonOfferLink')}
									<span aria-hidden="true" className={styles.cartoonOfferArrows}>
										<span>›</span>
										<span>›</span>
										<span>›</span>
									</span>
								</Link>
							</p>
						) : isCatalogMode ? (
							<p>{t('products.priceInquiry', { price: product.price })}</p>
						) : (
							<p>{t('products.price', { price: product.price })}</p>
						)}

						<div className={styles.actionButtonsContainer}>
							{shouldUseInquiryAction ? (
								<button onClick={handleInquiry} className={styles.actionBtn}>
									{t('catalogMode.inquiryCta')}
								</button>
							) : (
								<button
									onClick={handleAddToCart}
									className={styles.actionBtn}
									data-testid="add-to-cart-button"
								>
									{t('products.addToCart')}
								</button>
							)}

							{canEdit && (
								<div className={styles.ownerActions}>
									<Link href={`/products/${product._id}/edit`} className={styles.actionBtn}>
										{t('products.edit')}
									</Link>
									<Link href={`/products/${product._id}/delete`} className={styles.actionBtn}>
										{t('products.delete')}
									</Link>
								</div>
							)}

							{isFullAdmin && (
								<Link
									href={`/translations?entityType=product&entityId=${encodeURIComponent(product._id)}`}
									className={styles.actionBtn}
								>
									EN превод
								</Link>
							)}

							{isFullAdmin && isPendingReview && (
								<div className={styles.ownerActions}>
									<button
										type="button"
										onClick={handleApproveProduct}
										className={styles.actionBtn}
										disabled={reviewActionLoading !== ''}
									>
										{reviewActionLoading === 'approve' ? t('products.approving') : t('products.approve')}
									</button>
									<button
										type="button"
										onClick={handleRejectProduct}
										className={styles.actionBtn}
										disabled={reviewActionLoading !== ''}
									>
										{reviewActionLoading === 'reject' ? t('products.rejecting') : t('products.reject')}
									</button>
								</div>
							)}

							{user && (
								<Link
									href={`/newsletter/send?source=product&id=${product._id}`}
									className={`${styles.actionBtn} ${styles.newsletterActionBtn}`}
								>
									{t('products.sendNewsletter')}
								</Link>
							)}
						</div>
					</>
				)}
			</div>

			<div className={styles.productDetailsImagesContainer}>
				<div
					ref={gestureRef}
					className={styles.productDetailsMainImage}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={finishDrag}
					onPointerCancel={finishDrag}
				>
					{hasMultiple && (
						<button
							type="button"
							onClick={showPrev}
							aria-label={t('products.previousImage')}
							className={`${styles.imageNavBtn} ${styles.imageNavBtnLeft}`}
						>
							‹
						</button>
					)}

					{mediaSlides.length > 0 ? (
						<div
							className={styles.productImageTrack}
							style={{
								transform: `translateX(calc(-${trackIndex * 100}% + ${dragOffset}px))`,
								transition: isDragging || !transitionEnabled ? 'none' : undefined,
							}}
							onTransitionEnd={handleTrackTransitionEnd}
						>
							{loopedMediaSlides.map((slide, index) => {
								const isClone = mediaSlides.length > 1 && (index === 0 || index === loopedMediaSlides.length - 1);
								const logicalIndex = mediaSlides.length > 1
									? index === 0
										? mediaSlides.length - 1
										: index === loopedMediaSlides.length - 1
											? 0
											: index - 1
									: index;
								const isActiveSlide = !isClone && logicalIndex === currentIndex;
								const shouldMountVideo = slide.type === 'video' && isActiveSlide;

								return (
									<div
										key={`${slide.key}-${index}`}
										className={styles.productImageSlide}
										aria-hidden={isClone || logicalIndex !== currentIndex}
									>
										{slide.type === 'video' ? (
											<>
												{shouldMountVideo ? (
													<video
														ref={(node) => setVideoRef(slide.key, node)}
														src={slide.url}
														poster={slide.posterUrl}
														muted
														autoPlay
														playsInline
														preload="auto"
														controls
														className={`${styles.productMainVideo} ${styles.productVideoElement}`}
														onLoadedData={() => tryAutoplayVideo(slide.key)}
														onEnded={handleVideoEnded}
														aria-label={t('products.videoLabel', { title: product.title })}
													>
														{t('products.videoUnsupported')}
													</video>
												) : (
													<Image
														src={slide.posterUrl}
														alt={t('products.videoLabel', { title: product.title })}
														width={1600}
														height={1600}
														sizes="(max-width: 768px) 90vw, (max-width: 1200px) 50vw, 40vw"
														className={styles.productMainImage}
														loading="lazy"
													/>
												)}
												<span className={styles.videoBadge}>{t('products.videoBadge')}</span>
											</>
										) : (
											<Image
												src={slide.url}
												alt={product.title}
												width={1600}
												height={1600}
												sizes="(max-width: 768px) 90vw, (max-width: 1200px) 50vw, 40vw"
												className={styles.productMainImage}
												priority={!isClone && logicalIndex === 0}
												loading={!isClone && logicalIndex === 0 ? undefined : 'lazy'}
											/>
										)}
									</div>
								);
							})}
						</div>
					) : null}

					{hasMultiple && (
						<button
							type="button"
							onClick={showNext}
							aria-label={t('products.nextImage')}
							className={`${styles.imageNavBtn} ${styles.imageNavBtnRight}`}
						>
							›
						</button>
					)}
				</div>
			</div>
		</section>
	);
}
