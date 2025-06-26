import { z } from 'zod';

// Assuming you've defined these from before
const NextProductSchema = z.object({
	__typename: z.literal('NEXT_PRODUCT'),
	id: z.string(),
	title: z.string(),
	slug: z.string(),
	dependencies: z.array(z.any()),
	customisable: z.boolean(),
	isLandscape: z.boolean(),
	clickRankDocumentCount: z.number(),
	category: z.object({ __ref: z.string() }),
	rating: z.object({
		__typename: z.string(),
		count: z.number(),
		score: z.number(),
	}),
	masterVariant: z.object({
		key: z.string(),
		title: z.string(),
		subtitle: z.string(),
		inStock: z.boolean(),
		sku: z.string(),
		minimumQuantity: z.number(),
		price: z.object({
			__typename: z.string(),
			centAmount: z.number(),
			currencyCode: z.string(),
			fractionDigits: z.number(),
		}),
		fullPrice: z.object({
			__typename: z.string(),
			centAmount: z.number(),
			currencyCode: z.string(),
			fractionDigits: z.number(),
		}),
		discountedPercentage: z.number().nullable(),
		bundles: z.array(z.any()),
		dimensions: z.object({
			__typename: z.string(),
			description: z.string(),
		}),
		capabilities: z.object({
			__typename: z.string(),
			video: z.boolean(),
		}),
		productImages: z.object({
			__typename: z.string(),
			mainImage: z.object({
				__typename: z.string(),
				medium: z.object({
					__typename: z.string(),
					jpgUrl: z.string(),
				}),
			}),
			images: z.array(
				z.object({
					__typename: z.string(),
					thumb: z.object({
						__typename: z.string(),
						jpgUrl: z.string(),
					}),
					small: z.object({
						__typename: z.string(),
						jpgUrl: z.string(),
					}),
					medium: z.object({
						__typename: z.string(),
						jpgUrl: z.string(),
					}),
					large: z.object({
						__typename: z.string(),
						jpgUrl: z.string(),
					}),
					extraLarge: z.object({
						__typename: z.string(),
						jpgUrl: z.string(),
					}),
					original: z.object({
						__typename: z.string(),
						jpgUrl: z.string(),
					}),
				})
			),
		}),
		images: z.array(
			z.object({
				__typename: z.string(),
				url: z.string(),
			})
		),
		masterImage: z.object({
			__typename: z.string(),
			url: z.string(),
		}),
	}),
	variants: z.array(
		z.object({
			__typename: z.string(),
			key: z.string(),
			title: z.string(),
			subtitle: z.string(),
			inStock: z.boolean(),
			sku: z.string(),
			minimumQuantity: z.number(),
			price: z.object({
				__typename: z.string(),
				centAmount: z.number(),
				currencyCode: z.string(),
				fractionDigits: z.number(),
			}),
			fullPrice: z.object({
				__typename: z.string(),
				centAmount: z.number(),
				currencyCode: z.string(),
				fractionDigits: z.number(),
			}),
			discountedPercentage: z.number().nullable(),
			bundles: z.array(z.any()),
			dimensions: z
				.object({
					__typename: z.string(),
					description: z.string(),
				})
				.nullable(),
			capabilities: z.object({
				__typename: z.string(),
				video: z.boolean(),
			}),
		})
	),
	hasAugmentedReality: z.boolean(),
	productPills: z.array(z.any()),
	primaryProductPill: z.any(),
	publishDate: z.string(),
	isSponsored: z.boolean(),
});

const NextCategorySchema = z.object({
	__typename: z.literal('NEXT_CATEGORY'),
	id: z.number(),
	slug: z.string(),
	name: z.string(),
	department: z.string(),
});

// 👇 Key: string, Value: NEXT_PRODUCT or NEXT_CATEGORY
const ApolloInitialStateSchema = z.record(z.union([NextProductSchema, NextCategorySchema]));

// 👇 Wrap in DataSchema
const DataSchema = z.object({
	props: z.object({
		pageProps: z.object({
			appProps: z.object({
				graphQLInitialState: z.object({
					apolloInitialState: ApolloInitialStateSchema,
				}),
			}),
		}),
	}),
});

export function ValidateProductSchema(obj: unknown) {
	const parsed = DataSchema.safeParse(obj);

	if (!parsed.success) {
		console.error(parsed.error.format());
	} else {
		return parsed.data;
	}
}
