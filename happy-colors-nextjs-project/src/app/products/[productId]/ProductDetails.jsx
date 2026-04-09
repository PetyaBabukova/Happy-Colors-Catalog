// happy-colors-nextjs-project/src/app/products/[productId]/ProductDetails.jsx

'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { isOwner } from '@/utils/isOwner';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { isCatalogMode } from '@/utils/catalogMode';
import Image from 'next/image';
import useImageSlideshow from '@/hooks/useImageSlideshow';
import { normalizeImageUrls } from '@/utils/normalizeImageUrls';
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

	const imageUrls = useMemo(() => normalizeImageUrls(product), [product]);
	const [activeTab, setActiveTab] = useState('description');
	const { currentIndex, currentUrl, hasMultiple, showPrev, showNext } = useImageSlideshow(
		imageUrls,
		5000,
		{ resetKey: product._id }
	);

	const isAvailable = product?.availability !== 'unavailable';

	const availabilityLabel = isAvailable
		? 'Продуктът е наличен'
		: 'Продуктът не е наличен';

	const handleAddToCart = () => {
		addToCart({
			_id: product._id,
			title: product.title,
			price: product.price,
			image: currentUrl || product.imageUrl || '',
		});

		router.push('/cart');
	};

	const handleInquiry = () => {
		router.push(`/contacts?productId=${product._id}`);
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
				<div className={styles.productDetailsMainImage}>
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

					{imageUrls.length > 0 ? (
						<div
							className={styles.productImageTrack}
							style={{ transform: `translateX(-${currentIndex * 100}%)` }}
						>
							{imageUrls.map((url, index) => (
								<div
									key={`${url}-${index}`}
									className={styles.productImageSlide}
									aria-hidden={index !== currentIndex}
								>
									<Image
										src={url}
										alt={product.title}
										width={1600}
										height={1600}
										sizes="(max-width: 768px) 90vw, (max-width: 1200px) 50vw, 40vw"
										className={styles.productMainImage}
										priority={index === 0}
										loading={index === 0 ? undefined : 'lazy'}
									/>
								</div>
							))}
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
