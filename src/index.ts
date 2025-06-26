import { json2csv as converter } from 'json-2-csv';
import * as cheerio from 'cheerio';
import fs from 'fs';
import console from 'console';
import path, { join } from 'path';
import { ValidateProductSchema } from './validation';

console.clear();

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

	batchDir: path.join(process.cwd(), 'batches'),
	csvPath: path.join(process.cwd(), 'output.csv'),

	currentOffset: 0,
	offsetAmount: 24,

	items: [] as NavigationItem[],

	saveCsv: (csv: string) => {
		const dir = path.dirname(state.csvPath);

		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		fs.writeFileSync(state.csvPath, csv);
	},

	saveBatch: (products: Product[], batchId: number) => {
		if (!fs.existsSync(state.batchDir)) {
			console.log('creating out dir');
			fs.mkdirSync(state.batchDir, { recursive: true });
		}

		const p = path.join(state.batchDir, `${batchId}.json`);

		console.log('saving state on ' + p);

		fs.writeFileSync(p, JSON.stringify(products));
	},
};

function setup() {
	//remove  any stale data so we can fetch again
	if (fs.existsSync(state.batchDir)) {
		fs.rmSync(state.batchDir, { force: true });
	}
}

async function NextDataFromURL(url: string) {
	const res = await fetch(url);

	if (!res.ok) {
		console.error(`fetching from ${url} got status of ${res.status} with a message: ${res.statusText}`);
		return;
	}

	let html: string = '';

	try {
		html = await res.text();
	} catch (e) {
		console.error(`could not decode html for some reason`);
	}

	const $ = cheerio.load(html);

	return $('#__NEXT_DATA__').html();
}

async function run() {
	const initialData = await NextDataFromURL(state.initialUrl.toString());

	if (!initialData) {
		return;
	}

	const items = await getCardItems(initialData);
	if (items == null) {
		console.error('could not get page items');
		return;
	}
	state.items = items;

	for (const item of state.items) {
		state.currentOffset = 0;
		const newUrl = new URL(state.initialUrl);
		const promises: Promise<any>[] = [];

		while (state.currentOffset < item.count) {
			newUrl.searchParams.set('offset', state.currentOffset.toString());
			newUrl.searchParams.set('filters', `${item.parent}:${item.id}`);

			console.log('fetching data from ' + newUrl.toString());

			state.batchId++;
			const currentBatch = state.batchId;

			promises.push(
				NextDataFromURL(newUrl.toString())
					.then(async (itemData) => {
						if (itemData == null) {
							return;
						}
						const newProducts = await getItemsUrls(itemData, item.parent);

						if (newProducts) {
							state.saveBatch(newProducts, currentBatch);
						}
					})
					.catch((e) => {
						console.error(`error at fetching new data from url`);
						console.error(e);
						return e;
					})
			);
			state.currentOffset = state.currentOffset + state.offsetAmount;
		}
		await Promise.allSettled(promises);
	}

	const csv = await convertToCsv();

	if (!csv) {
		console.error('could not process the products to the csv');
		return;
	}

	state.saveCsv(csv);
}

async function convertToCsv() {
	if (!fs.existsSync(state.batchDir) || !fs.statSync(state.batchDir).isDirectory()) {
		console.error(`save path must exist and must be an directory`);
		return;
	}

	const filenames = fs.readdirSync(state.batchDir).map((filename) => path.join(state.batchDir, filename));

	//this way we prevent any copies of the same item
	const allProducts: Record<string, Product> = {};

	for (const filename of filenames) {
		if (!fs.statSync(filename).isFile()) {
			continue;
		}

		const file = fs.readFileSync(filename, { encoding: 'utf-8' });
		let parsed: Product[] = [];

		try {
			parsed = JSON.parse(file);
		} catch (err) {
			console.error(err);
		}

		for (const item of parsed) {
			if (item.name in allProducts) {
				continue;
			}

			item.cover_image = item.cover_image;

			allProducts[item.name] = item;
		}
	}

	return converter(Object.values(allProducts));
}

async function getItemsUrls(content: string, subcategory: string) {
	if (!content) {
		console.error('could not grab content ');
		return;
	}

	const parsed = JSON.parse(content);

	const validated = ValidateProductSchema(parsed);

	if (!validated) {
		return;
	}

	const items = validated.props.pageProps.appProps.graphQLInitialState.apolloInitialState;

	const categories: FormattedCategory[] = [];

	const products: NEXT_PRODUCT[] = [];

	const mainProducts: Product[] = [];

	for (const key of Object.values(items)) {
		const str = key.__typename.toLowerCase();

		if (str.includes('category')) {
			//since were not using the base category again
			//we save a ton of memory and speed by altering the same object

			const cat = key as NEXT_CATEGORY & FormattedCategory;
			cat.ref = `ProductCategory:${cat.id}`;

			categories.push(cat);
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

		//they put the category after the .jpg, this is so we still have the full image
		p.all_images = otherImages.map((im) => im.url).join('|');

		p.price = product.masterVariant.price.centAmount.toString();

		p.subcategory = subcategory;
		mainProducts.push(p);
	}

	return mainProducts;
}

(async () => {
	setup();
	await run()
		.then(() => process.kill(0))
		.catch(() => process.kill(1));
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
