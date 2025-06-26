export {};

declare global {
	export type Product = {
		url: string;
		name: string;
		price: string;
		cover_image: string;
		all_images: string;
		subcategory: string;
		category: string;
	};
	export type NEXT_PRODUCT = {
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

	export type Money = {
		__typename: string;
		centAmount: number;
		currencyCode: string;
		fractionDigits: number;
	};

	export type Image = {
		__typename: string;
		url: string;
	};

	export type SizedImage = {
		__typename: string;
		jpgUrl: string;
	};

	export type ProductImage = {
		__typename: string;
		thumb: SizedImage;
		small: SizedImage;
		medium: SizedImage;
		large: SizedImage;
		extraLarge: SizedImage;
		original: SizedImage;
	};

	export type ProductImages = {
		__typename: string;
		mainImage: {
			__typename: string;
			medium: SizedImage;
		};
		images: ProductImage[];
	};

	export type ProductVariant = {
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

	export type NEXT_CATEGORY = {
		__typename: string;
		id: number;
		slug: string;
		name: string;
		department: string;
	};

	export type FormattedCategory = {
		ref: string;
	} & NEXT_CATEGORY;
}
