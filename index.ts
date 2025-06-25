import pupeteer from 'puppeteer-core';

import * as cheerio from 'cheerio';

// import * as launcher from 'chrome-launcher';

import fs, { promises } from 'fs';
import console from 'console';
import path from 'path';

console.clear();

type Product = {
	url: string;
	name: string;
	price: string;
	cover_image: string;
	all_images: string;
	subcategory: string;
	category: string;
};

// async function getbrowser() {
// 	let browser;

// 	const installation = launcher.Launcher.getFirstInstallation();

// 	if (!installation) {
// 		console.error('no chrome installed, cannot execute script');
// 		process.abort();
// 	}

// 	try {
// 		browser = await pupeteer.launch({
// 			headless: false, // set to `true` if you don't want the browser to be visible
// 			executablePath: installation,
// 			args: ['--no-sandbox', '--disable-setuid-sandbox'],
// 		});
// 	} catch (e) {
// 		console.error(e);
// 	}

// 	return browser;
// }

type NavigationItem = {
	__typename: string;
	id: string;
	parent: string;
	count: number;
	isSelected: boolean;
	label: string;
};

function newProduct(): Product {
	return {
		url: '',
		all_images: '',
		category: '',
		cover_image: '',
		name: '',
		price: '',
		subcategory: '',
	};
}

const state = {
	initialUrl: new URL('https://www.moonpig.com/us/personalised-cards/all/'),

	batchId: 0,

	savePath: './batches',

	currentOffset: 0,
	offsetAmount: 24,

	//do the typings before
	items: [] as NavigationItem[],

	save: (products: Product[], batchId: number) => {
		if (!fs.existsSync(state.savePath)) {
			console.log('creating out dir');
			fs.mkdirSync(state.savePath, { recursive: true });
		}

		const p = path.join(state.savePath, `${batchId}.json`);

		console.log('saving state on ' + p);

		fs.writeFileSync(p, JSON.stringify(products));
	},

	currentCategory: '',

	page: {} as pupeteer.Page,

	currentUrl: () => state.page.url(),
};

function setup() {
	if (fs.existsSync(state.savePath)) {
		fs.rmSync(state.savePath, { force: true });
	}

	try {
		const items = fs.readFileSync('./baseItems.json', { encoding: 'utf-8' });
		if (items) {
			state.items = JSON.parse(items);
		}
	} catch (e) {
		console.error(e);
	}
}

async function NextDataFromURL(url: string) {
	const res = await fetch(url);

	const html = await res.text();

	const $ = cheerio.load(html);

	return $('#__NEXT_DATA__').html();
}

async function run() {
	const initialData = await NextDataFromURL(state.initialUrl.toString());

	if (!initialData) {
		return;
	}

	if (state.items.length == 0) {
		const items = await getCardItems(initialData);

		if (items == null) {
			console.error('could not get page items');
			return;
		}

		state.items = items;
		fs.writeFileSync('./baseItems.json', JSON.stringify(state.items));
	}

	for (const item of state.items) {
		state.currentOffset = 0;
		const newUrl = new URL(state.initialUrl);

		const promises: Promise<any>[] = [];

		//need to see if this sum is correct
		while (state.currentOffset < item.count) {
			newUrl.searchParams.set('offset', state.currentOffset.toString());

			newUrl.searchParams.set('filters', `${item.parent}:${item.id}`);

			console.log('fetching data from ' + newUrl.toString());
			state.batchId++;

			const currentBatch = state.batchId;

			promises.push(
				NextDataFromURL(newUrl.toString()).then(async (itemData) => {
					if (itemData == null) {
						return;
					}

					const newProducts = await getItemsUrls(itemData, item.parent);

					if (newProducts) {
						state.save(newProducts, currentBatch);
					}
				})
			);

			state.currentOffset = state.currentOffset + state.offsetAmount;
		}

		await Promise.allSettled(promises);
	}
}

async function getItemsUrls(content: string, subcategory: string) {
	if (!content) {
		console.error('could not grab content ');
		return;
	}

	const parsed = JSON.parse(content);

	const items: Record<string, NEXT_CATEGORY | NEXT_PRODUCT> =
		parsed.props.pageProps.appProps.graphQLInitialState.apolloInitialState;

	const categories: FormattedCategory[] = [];

	const products: NEXT_PRODUCT[] = [];

	const mainProducts: Product[] = [];

	for (const key of Object.values(items)) {
		const str = key.__typename.toLowerCase();

		if (str.includes('category')) {
			const cat = key as NEXT_CATEGORY;
			categories.push({
				...cat,
				ref: `ProductCategory:${cat.id}`,
			});
		} else if (str.includes('product')) {
			products.push(key as NEXT_PRODUCT);
		}
	}

	for (const product of products) {
		const p = newProduct();

		p.name = product.title;

		const category = categories.find((cat) => cat.ref === product.category.__ref);

		if (category) {
			p.category = category.name;
		}
		const image = product.masterVariant.images.find(Boolean);

		if (image) {
			p.cover_image = image.url;
		}

		const otherImages = product.masterVariant.images.filter((i) => i.url !== image?.url);

		p.all_images = otherImages.map((im) => im.url).join('|');

		p.price = product.masterVariant.price.centAmount.toString();

		p.subcategory = subcategory;
		mainProducts.push(p);
	}

	return mainProducts;
}

(async () => {
	setup();
	await run();
})();

async function getCardItems(str: string): Promise<NavigationItem[] | undefined> {
	const parsed = JSON.parse(str);

	let navItems = [];

	try {
		navItems = parsed.props.pageProps.pageProps.content.props.initialFiltersResponse.filters;
	} catch (err) {
		console.error(err);
		return;
	}

	const allowedFilters = ['occasion', 'topic'];

	const allowedItems: NavigationItem[] = [];

	for (const item of navItems) {
		if (typeof item !== 'object' || !item || !('label' in item) || typeof item.label != 'string') {
			continue;
		}

		const label = (item.label as string).toLowerCase();

		if (!allowedFilters.includes(label) || !('children' in item) || !Array.isArray(item.children)) {
			continue;
		}

		for (const child of item.children) {
			if (!('parent' in child) || !('count' in child) || !('id' in child)) {
				continue;
			}
			allowedItems.push(child);
		}
	}

	return allowedItems;
}

type NEXT_PRODUCT = {
	__typename: string;
	id: string;
	title: string;
	slug: string;
	dependencies: any[];
	customisable: boolean;
	isLandscape: boolean;
	clickRankDocumentCount: number;
	category: { __ref: string };
	rating: {
		__typename: string;
		count: number;
		score: number;
	};
	masterVariant: {
		key: string;
		title: string;
		subtitle: string;
		inStock: boolean;
		sku: string;
		minimumQuantity: number;
		price: Money;
		fullPrice: Money;
		discountedPercentage: number | null;
		bundles: any[];
		dimensions: {
			__typename: string;
			description: string;
		};
		capabilities: {
			__typename: string;
			video: boolean;
		};
		productImages: ProductImages;
		images: Image[];
		masterImage: Image;
	};
	variants: ProductVariant[];
	hasAugmentedReality: boolean;
	productPills: any[];
	primaryProductPill: any;
	publishDate: string;
	isSponsored: boolean;
};

type Money = {
	__typename: string;
	centAmount: number;
	currencyCode: string;
	fractionDigits: number;
};

type Image = {
	__typename: string;
	url: string;
};

type SizedImage = {
	__typename: string;
	jpgUrl: string;
};

type ProductImage = {
	__typename: string;
	thumb: SizedImage;
	small: SizedImage;
	medium: SizedImage;
	large: SizedImage;
	extraLarge: SizedImage;
	original: SizedImage;
};

type ProductImages = {
	__typename: string;
	mainImage: {
		__typename: string;
		medium: SizedImage;
	};
	images: ProductImage[];
};

type ProductVariant = {
	__typename: string;
	key: string;
	title: string;
	subtitle: string;
	inStock: boolean;
	sku: string;
	minimumQuantity: number;
	price: Money;
	fullPrice: Money;
	discountedPercentage: number | null;
	bundles: any[];
	dimensions: {
		__typename: string;
		description: string;
	} | null;
	capabilities: {
		__typename: string;
		video: boolean;
	};
};

type NEXT_CATEGORY = {
	__typename: string;
	id: number;
	slug: string;
	name: string;
	department: string;
};

type FormattedCategory = {
	ref: string;
} & NEXT_CATEGORY;
