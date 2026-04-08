// happy-colors-nextjs-project/src/app/products/[productId]/ProductDetails.jsx

'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { isOwner } from '@/utils/isOwner';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { isCatalogMode } from '@/utils/catalogMode';
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

export default function ProductDetails({ product }) {
	const { user } = useAuth();
	const { addToCart } = useCart();
	const canEdit = isOwner(product, user);
	const router = useRouter();

	const imageUrls = useMemo(() => {
		if (Array.isArray(product?.imageUrls) && product.imageUrls.length > 0) {
			return product.imageUrls.filter(Boolean);
		}

		if (product?.imageUrl) {
			return [product.imageUrl];
		}

		return [];
	}, [product]);

	const [currentImageIndex, setCurrentImageIndex] = useState(0);
	const [activeTab, setActiveTab] = useState('description');

	const isAvailable = product?.availability !== 'unavailable';

	const availabilityLabel = isAvailable
		? 'Продуктът е наличен'
		: 'Продуктът не е наличен';

	const mainImage = imageUrls[currentImageIndex] || product.imageUrl || '';
	const hasMultipleImages = imageUrls.length > 1;

	const handleAddToCart = () => {
		addToCart({
			_id: product._id,
			title: product.title,
			price: product.price,
			image: mainImage,
		});

		router.push('/cart');
	};

	const handleInquiry = () => {
		router.push(`/contacts?productId=${product._id}`);
	};

	const showPrevImage = () => {
		setCurrentImageIndex((prevIndex) =>
			prevIndex === 0 ? imageUrls.length - 1 : prevIndex - 1
		);
	};

	const showNextImage = () => {
		setCurrentImageIndex((prevIndex) =>
			prevIndex === imageUrls.length - 1 ? 0 : prevIndex + 1
		);
	};

	return (
		<section className={styles.productDetails}>
			<div className={styles.productDescriptionContainer}>
				<h1>{product.title}</h1>

				<div className={styles.reviewContainer}>
					<div className={styles.starsEmpty}>
						{[...Array(5)].map((_, i) => (
							<i key={i} className="fa-regular fa-star"></i>
						))}
					</div>
				</div>

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
					{hasMultipleImages && (
						<button
							type="button"
							onClick={showPrevImage}
							aria-label="Предишно изображение"
							className={`${styles.imageNavBtn} ${styles.imageNavBtnLeft}`}
						>
							‹
						</button>
					)}

					{mainImage && <img src={mainImage} alt={product.title} />}

					{hasMultipleImages && (
						<button
							type="button"
							onClick={showNextImage}
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