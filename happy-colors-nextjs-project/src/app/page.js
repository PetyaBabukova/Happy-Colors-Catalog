//happy-colors-nextjs-project/src/app/page.js

import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
	return (
		<>

			<section className={styles.heroSection}>
				<div className={styles.heroMedia} aria-hidden="true">
					<picture className={styles.heroPicture}>
						<source media="(max-width: 768px)" srcSet="/homepage_background_mobile.webp" />
						<source media="(min-width: 769px)" srcSet="/homepage_background_laptop.webp" />
						<img
							className={styles.heroImage}
							src="/homepage_background_laptop.webp"
							alt=""
							fetchPriority="high"
						/>
					</picture>
				</div>

				<div className={styles.heroContent}>
					<h1>Плетени играчки, аксесоари и декорация за дома</h1>
					<h4 className={styles.homeSubtitle}>Ръчно изработени изделия за подарък, уют и специални поводи.</h4>
					<div className={styles.heroBottom}>
						<p className={styles.homePageIntro}>
							В Happy Colors ще откриете ръчно изработени плетени играчки, аксесоари и декорация за дома, създадени с внимание към всеки детайл. Колекцията включва красиви и оригинални изделия, подходящи за подарък, детска стая, празник или уютен акцент у дома. Ако нещо ви хареса, можете да се свържете с мен за наличност, въпроси и поръчка. Разгледайте галерията и открийте изделие с характер, изработено с грижа и стил.
						</p>
						<Link href="/products" className={styles.hiroShopLink}>Каталог
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg>
						</Link>
					</div>
				</div>
			</section>

			{/* <section className={styles.shoppingCategories}>

				<article className={styles.shoppingCategory}>
					<Link href="/products/toys">
						<div className={styles.shoppingCategoryImageContainer}>
							<Image src="/toy_sample.jpg" alt="" width={300} height={300} />
						</div>
						<div className={styles.categoryDescription}>
							<h3>Животинки и играчки</h3>
							<p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, voluptatibus. Lorem ipsum
								dolor sit amet consectetur adipisicing elit. Quisquam, voluptatibus.</p>
							<p className={styles.learnMorelink}> Виж повече
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg>
							</p>
						</div>
					</Link>
				</article>

				<article className={styles.shoppingCategory}>
					<Link href="/products/dolls">
						<div className={styles.shoppingCategoryImageContainer}>
							<Image src="/toy_sample.jpg" alt="" width={300} height={300} />
						</div>
						<div className={styles.categoryDescription}>
							<h3>Кукли с аксесоари</h3>
							<p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, voluptatibus. Lorem ipsum
								dolor sit amet consectetur adipisicing elit. Quisquam, voluptatibus.</p>
							<p className={styles.learnMorelink}> Виж повече
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg>
							</p>
						</div>
					</Link>
				</article>

				<article className={styles.shoppingCategory}>
					<Link href="/products/scarves-and-hats">
						<div className={styles.shoppingCategoryImageContainer}>
							<Image src="/toy_sample.jpg" alt="" width={300} height={300} />
						</div>
						<div className={styles.categoryDescription}>
							<h3>Шалове и шапки</h3>
							<p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, voluptatibus. Lorem ipsum
								dolor sit amet consectetur adipisicing elit. Quisquam, voluptatibus.</p>
							<p className={styles.learnMorelink}> Виж повече
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg>
							</p>
						</div>
					</Link>
				</article>

				<article className={styles.shoppingCategory}>
					<Link href="/products/bags">
						<div className={styles.shoppingCategoryImageContainer}>
							<Image src="/toy_sample.jpg" alt="category-image" width={300} height={300} />
						</div>
						<div className={styles.categoryDescription}>
							<h3>Шалове и шапки</h3>
							<p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, voluptatibus. Lorem ipsum
								dolor sit amet consectetur adipisicing elit. Quisquam, voluptatibus.</p>
							<p className={styles.learnMorelink}> Виж повече
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z" /></svg>
							</p>
						</div>
					</Link>
				</article>

			</section> */}

			
		</>
	);
}
