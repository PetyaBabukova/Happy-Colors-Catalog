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
import styles from './details.module.css';

const deliveryContent = `
Начини на доставка:
• офис на Еконт или Спиди
• автомат на Еконт или Спиди
• автомат на Box Now
Към момента не предлагаме доставка до личен адрес.
Цена на доставката:
За поръчки на стойност над 50 евро доставката е безплатна.
За поръчки под тази стойност цената на доставката е за сметка на клиента и се определя според тарифите на куриерската фирма.
Срок за изпращане:
Наличните продукти се изпращат в рамките на до 1 работен ден.
Срокът за получаване зависи от куриерската фирма и локацията на получателя.
Неналични продукти:
Ако продуктът не е наличен, можете да изпратите запитване чрез контактната форма на сайта.
`;

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

export default function ProductDetails({ product }) {
	const { user } = useAuth();
	const { addToCart } = useCart();
	const canEdit = isOwner(product, user);
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

	const availabilityLabel = isAvailable
		? 'Продуктът е наличен'
		: 'Продуктът не е наличен';

	const handleAddToCart = () => {
		addToCart({
			_id: product._id,
			title: product.title,
			price: product.price,
			image: activeSlide?.type === 'image'
				? activeSlide.url
				: imageUrls[0] || videos[0]?.posterUrl || product.imageUrl || '',
		});

		router.push('/cart');
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
		router.push(`/contacts?productId=${product._id}`);
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
			<div className={styles.productDescriptionContainer}>
				<h1>{product.title}</h1>

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
							описание
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
								доставка и плащане
							</a>
						</li>
					)}
				</ul>

				<div className={styles.productDescriptionBody}>
					{activeTab === 'description' && (
						<p>{product.description}</p>
					)}

					{!isCatalogMode && activeTab === 'delivery' && (
						<p style={{ whiteSpace: 'pre-line' }}>{deliveryContent}</p>
					)}
				</div>

				{activeTab === 'description' && (
					<>
						<p className={isAvailable ? styles.available : styles.unavailable}>
							<b>Наличност:</b> {availabilityLabel}
						</p>

						<p>Цена {isCatalogMode && !user ? 'при запитване' : `${product.price} €`}</p>

						<div className={styles.actionButtonsContainer}>
							{isCatalogMode ? (
								<button onClick={handleInquiry} className={styles.actionBtn}>
									Попитай
								</button>
							) : isAvailable ? (
								<button onClick={handleAddToCart} className={styles.actionBtn}>
									Добави в количката
								</button>
							) : (
								<button
									onClick={handleInquiry}
									className={styles.actionBtn}
								>
									Попитай
								</button>
							)}

							{canEdit && (
								<div className={styles.ownerActions}>
									<Link href={`/products/${product._id}/edit`} className={styles.actionBtn}>
										Редактирай
									</Link>
									<Link href={`/products/${product._id}/delete`} className={styles.actionBtn}>
										Изтрий
									</Link>
								</div>
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
							aria-label="Предишно изображение"
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
														aria-label={`${product.title} видео`}
													>
														Вашият браузър не поддържа видео. Можете да разгледате снимките на продукта.
													</video>
												) : (
													<Image
														src={slide.posterUrl}
														alt={`${product.title} видео`}
														width={1600}
														height={1600}
														sizes="(max-width: 768px) 90vw, (max-width: 1200px) 50vw, 40vw"
														className={styles.productMainImage}
														loading="lazy"
													/>
												)}
												<span className={styles.videoBadge}>Видео</span>
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
							aria-label="Следващо изображение"
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
