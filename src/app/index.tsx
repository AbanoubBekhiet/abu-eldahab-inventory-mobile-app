import React, { useState, useEffect, useCallback } from "react";
import {
	StyleSheet,
	View,
	Text,
	TextInput,
	TouchableOpacity,
	ScrollView,
	FlatList,
	Alert,
	ActivityIndicator,
	Image,
	Dimensions,
	RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import {
	fetchAppProducts,
	fetchCategories,
	fetchUserProfile,
	getFavoriteIds,
	toggleFavoriteId,
	getCartItems,
	addProductToCart,
	updateCartItemQty,
	isAdminOrSubAdmin,
	fetchActiveOffers,
	getSettingsLogoUrl,
	Product,
	Category,
	CartItem,
	User,
	OfferItem,
} from "../services/api";
import MobileFooterNav from "../components/mobile-footer";
import { AppImage } from "../components/app-image";
import { useRoleGuard } from "../hooks/useRoleGuard";

export default function MobileHomeScreen() {
	useRoleGuard("customer");
	const router = useRouter();
	const [products, setProducts] = useState<Product[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [userProfile, setUserProfile] = useState<User | null>(null);
	const [selectedCategory, setSelectedCategory] = useState<string | number>(
		"all",
	);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);

	// Favorite Product IDs
	const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

	// Real Persistent Cart State
	const [cartItems, setCartItems] = useState<CartItem[]>([]);

	// Active Offers
	const [activeOffers, setActiveOffers] = useState<OfferItem[]>([]);

	// Logo URL
	const logoUrl = getSettingsLogoUrl();

	// Carousel State
	const [activeOfferIndex, setActiveOfferIndex] = useState(0);
	const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
		if (viewableItems.length > 0) {
			setActiveOfferIndex(viewableItems[0].index || 0);
		}
	}, []);
	const viewabilityConfig = { itemVisiblePercentThreshold: 50 };

	// Refresh cart + favorites every time screen is focused
	useFocusEffect(
		useCallback(() => {
			let active = true;
			const loadData = async () => {
				try {
					const [user, cats, favs, cart, offers] = await Promise.all([
						fetchUserProfile(),
						fetchCategories(),
						getFavoriteIds(),
						getCartItems(),
						fetchActiveOffers(),
					]);
					if (!active) return;
					if (user) setUserProfile(user);
					setCategories(Array.isArray(cats) ? cats : []);
					setFavoriteIds(Array.isArray(favs) ? [...favs.map(Number)] : []);
					setCartItems(Array.isArray(cart) ? [...cart] : []);
					setActiveOffers(Array.isArray(offers) ? offers : []);
				} catch (e) {
					if (!active) return;
					setCategories([]);
				}
			};
			loadData();
			return () => { active = false; };
		}, [])
	);

	const [nextPage, setNextPage] = useState<number | null>(null);
	const [loadingMore, setLoadingMore] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await Promise.all([
				loadProducts(true),
				(async () => {
					const [user, cats, favs, cart, offers] = await Promise.all([
						fetchUserProfile(),
						fetchCategories(),
						getFavoriteIds(),
						getCartItems(),
						fetchActiveOffers(),
					]);
					if (user) setUserProfile(user);
					setCategories(Array.isArray(cats) ? cats : []);
					setFavoriteIds(Array.isArray(favs) ? [...favs.map(Number)] : []);
					setCartItems(Array.isArray(cart) ? [...cart] : []);
					setActiveOffers(Array.isArray(offers) ? offers : []);
				})()
			]);
		} catch (e) {
			console.log("Refresh error", e);
		} finally {
			setRefreshing(false);
		}
	}, [search, selectedCategory]);

	useEffect(() => {
		loadProducts(true);
	}, [search, selectedCategory]);

	const loadProducts = async (isInitial = true) => {
		if (isInitial) {
			setLoading(true);
			try {
				const res = await fetchAppProducts(search, selectedCategory, 1);
				setProducts(Array.isArray(res.products) ? res.products : []);
				setNextPage(res.nextPage);
			} catch (e) {
				setProducts([]);
				setNextPage(null);
			} finally {
				setLoading(false);
			}
		}
	};

	const loadMoreProducts = async () => {
		if (!nextPage || loadingMore || loading) return;
		setLoadingMore(true);
		try {
			const res = await fetchAppProducts(search, selectedCategory, nextPage);
			if (Array.isArray(res.products) && res.products.length > 0) {
				setProducts((prev) => [...prev, ...res.products]);
			}
			setNextPage(res.nextPage);
		} catch (e) {
			// keep current products
		} finally {
			setLoadingMore(false);
		}
	};

	const handleToggleFavorite = async (productId: number | string) => {
		const pId = Number(productId);
		// Optimistic update
		setFavoriteIds((prev) => {
			if (prev.includes(pId)) return prev.filter((id) => id !== pId);
			return [...prev, pId];
		});
		// Persist to storage
		const updated = await toggleFavoriteId(pId);
		setFavoriteIds([...updated.map(Number)]);
	};

	const handleAddToCart = async (product: Product) => {
		if (!product || !product.id) return;
		const targetId = Number(product.id);
		const existing = cartItems.find((i) => Number(i.product_id || i.id) === targetId);
		const currentQty = existing?.quantity || 0;
		const maxAllowed = product.max_app_order_quantity;
		const maxAllowedNum = Number(maxAllowed);

		// Only enforce limits for customers — admins/sub-admins have no restrictions
		if (!isAdminOrSubAdmin(userProfile)) {
			if (
				maxAllowed !== null &&
				maxAllowed !== undefined &&
				!isNaN(maxAllowedNum) &&
				maxAllowedNum > 0 &&
				currentQty >= maxAllowedNum
			) {
				Alert.alert(
					"حد الكمية المسموحة",
					`عذراً، أقصى كمية مسموح بشرائها هي ${maxAllowedNum} قطعة فقط.`,
				);
				return;
			}
		}

		// Optimistic update
		setCartItems((prev) => {
			const idx = prev.findIndex((i) => Number(i.product_id || i.id) === targetId);
			if (idx > -1) {
				const updated = [...prev];
				let newQty = updated[idx].quantity + 1;
				const maxLimit = product.max_app_order_quantity;
				const maxLimitNum = Number(maxLimit);
				if (maxLimit !== null && maxLimit !== undefined && !isNaN(maxLimitNum) && maxLimitNum > 0) {
					if (newQty > maxLimitNum) newQty = maxLimitNum;
				}
				updated[idx] = { ...updated[idx], quantity: newQty };
				return updated;
			} else {
				return [
					...prev,
					{
						id: targetId,
						product_id: targetId,
						name: product.name,
						price: Number(product.price) || 0,
						quantity: 1,
						image_url: product.image_url,
						category_name: product.category_name,
						max_app_order_quantity: product.max_app_order_quantity,
					},
				];
			}
		});

		// Persist to storage
		const updatedCart = await addProductToCart(product, 1);
		setCartItems([...updatedCart]);
	};

	const handleUpdateCartQty = async (productId: number | string, delta: number) => {
		const pId = Number(productId);
		const existing = cartItems.find((i) => Number(i.product_id || i.id) === pId);

		if (delta > 0 && existing && !isAdminOrSubAdmin(userProfile)) {
			const maxAllowed = existing.max_app_order_quantity;
			const maxAllowedNum = Number(maxAllowed);
			if (
				maxAllowed !== null &&
				maxAllowed !== undefined &&
				!isNaN(maxAllowedNum) &&
				maxAllowedNum > 0 &&
				existing.quantity >= maxAllowedNum
			) {
				Alert.alert(
					"حد الكمية المسموحة",
					`عذراً، أقصى كمية مسموح بشرائها هي ${maxAllowedNum} قطعة فقط.`
				);
				return;
			}
		}

		// Optimistic update
		setCartItems((prev) => {
			const updated = prev
				.map((item) => {
					if (Number(item.product_id || item.id) === pId) {
						let newQty = item.quantity + delta;
						const maxLimit = item.max_app_order_quantity;
						const maxLimitNum = Number(maxLimit);
						if (delta > 0 && maxLimit !== null && maxLimit !== undefined && !isNaN(maxLimitNum) && maxLimitNum > 0) {
							if (newQty > maxLimitNum) newQty = maxLimitNum;
						}
						return newQty > 0 ? { ...item, quantity: newQty } : null;
					}
					return item;
				})
				.filter(Boolean) as CartItem[];
			return [...updated];
		});

		// Persist to storage
		const updatedCart = await updateCartItemQty(pId, delta);
		setCartItems([...updatedCart]);
	};

	const totalCartItems = cartItems.reduce((sum, i) => sum + i.quantity, 0);

	return (
		<SafeAreaView style={styles.container}>
			<FlatList
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2E5A44"]} />
				}
				data={loading ? [] : products}
				keyExtractor={(item) => String(item.id)}
				numColumns={2}
				columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 14 }}
				contentContainerStyle={{ paddingBottom: 20 }}
				onEndReached={loadMoreProducts}
				onEndReachedThreshold={0.4}
				ListHeaderComponent={
					<>
						{/* Greeting Header with App Logo & User Name */}
						<View style={styles.greetingHeader}>
							<View style={styles.userAvatarBadge}>
								<Image
									source={{ uri: logoUrl }}
									style={{ width: 40, height: 40, borderRadius: 20 }}
									resizeMode="contain"
								/>
							</View>
							<View style={styles.greetingTexts}>
								<Text style={styles.greetingTitle}>
									{userProfile?.name ? `صباح الخير، ${userProfile.name}` : "مرحباً بك في تطبيق أبو الدهب"}
								</Text>
								<Text style={styles.greetingSub}>
									{userProfile?.shop_name || "جاهز لتسوق الخردوات والمنظفات والورقيات اليوم؟"}
								</Text>
							</View>
						</View>

						{/* Offers Carousel / FMCG Wholesale Banner */}
						{activeOffers.length > 0 ? (
							<View style={{ marginVertical: 10 }}>
								<FlatList
									data={activeOffers}
									keyExtractor={(item) => String(item.id)}
									horizontal
									pagingEnabled
									showsHorizontalScrollIndicator={false}
									onViewableItemsChanged={onViewableItemsChanged}
									viewabilityConfig={viewabilityConfig}
									renderItem={({ item }) => (
										<View style={{ width: Dimensions.get('window').width }}>
											<TouchableOpacity
												style={[styles.heroCard, { marginHorizontal: 20, marginVertical: 0, padding: 0 }]}
												onPress={() => router.push('/offers')}
												activeOpacity={0.9}
											>
												<View style={{ position: 'absolute', inset: 0, backgroundColor: '#2D3C1F' }}>
													<AppImage
														uri={item.product_image_url}
														style={{ width: '100%', height: '100%', opacity: 0.4 }}
														iconName="local-offer"
														iconSize={40}
													/>
												</View>
												<View style={[styles.heroContent, { zIndex: 1, padding: 20 }]}>
													<View style={styles.offerDiscountBadge}>
														<Text style={styles.offerDiscountText}>خصم {item.discount_percentage}%</Text>
													</View>
													<Text style={styles.heroTitle} numberOfLines={2}>{item.product_name}</Text>
													<View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 14 }}>
														<Text style={{ color: '#FFF', fontSize: 24, fontWeight: 'bold' }}>{item.offer_price} ج.م</Text>
														<Text style={{ color: '#BACDA5', fontSize: 16, textDecorationLine: 'line-through' }}>{item.original_price}</Text>
													</View>
													<TouchableOpacity
														style={styles.heroCtaBtn}
														onPress={() => router.push('/offers')}
													>
														<Text style={styles.heroCtaText}>تسوق العرض الآن</Text>
													</TouchableOpacity>
												</View>
											</TouchableOpacity>
										</View>
									)}
								/>
								{activeOffers.length > 1 && (
									<View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 6 }}>
										{activeOffers.map((_, idx) => (
											<View
												key={idx}
												style={{
													width: activeOfferIndex === idx ? 20 : 8,
													height: 8,
													borderRadius: 4,
													backgroundColor: activeOfferIndex === idx ? '#2D3C1F' : '#D4EAB7',
												}}
											/>
										))}
									</View>
								)}
							</View>
						) : (
							<View style={styles.heroCard}>
								<View style={styles.heroContent}>
									<Text style={styles.heroTitle}>أفضل أسعار الجملة للمواد الاستهلاكية</Text>
									<Text style={styles.heroSub}>
										جميع الخردوات والمنظفات والورقيات بأسعار التجزئة والجملة المباشرة
									</Text>
									<TouchableOpacity
										style={styles.heroCtaBtn}
										onPress={() => router.push('/offers')}
									>
										<Text style={styles.heroCtaText}>تسوق العروض الآن</Text>
									</TouchableOpacity>
								</View>
							</View>
						)}

						{/* FMCG Search Container */}
						<View style={styles.searchContainer}>
							<TextInput
								style={styles.searchInput}
								placeholder="ابحث عن الخردوات، المنظفات، أو الورقيات..."
								value={search}
								onChangeText={setSearch}
								placeholderTextColor="#75786E"
							/>
						</View>

						{/* Categories Horizontal Slider */}
						<View style={styles.sectionHeaderRow}>
							<TouchableOpacity onPress={() => router.push('/explore')}>
								<Text style={styles.seeAllText}>عرض الكل</Text>
							</TouchableOpacity>
							<Text style={styles.sectionTitle}>الأقسام والفئات</Text>
						</View>

						<View style={styles.categoriesWrapper}>
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								contentContainerStyle={styles.categoriesContainer}
							>
								<TouchableOpacity
									style={[
										styles.categoryItem,
										selectedCategory === "all" && styles.categoryItemActive,
									]}
									onPress={() => setSelectedCategory("all")}
								>
									<View style={styles.categoryIconCircle}>
										<MaterialIcons name="shopping-basket" size={24} color="#2D3C1F" />
									</View>
									<Text style={styles.categoryItemLabel}>الكل</Text>
								</TouchableOpacity>

								{categories.map((cat) => (
									<TouchableOpacity
										key={cat.id}
										style={[
											styles.categoryItem,
											selectedCategory === cat.id && styles.categoryItemActive,
										]}
										onPress={() => setSelectedCategory(cat.id)}
									>
										<AppImage
											uri={cat.image_url}
											style={styles.categoryIconCircle}
											iconName="shopping-basket"
											iconSize={24}
										/>
										<Text style={styles.categoryItemLabel} numberOfLines={1}>{cat.name}</Text>
									</TouchableOpacity>
								))}
							</ScrollView>
						</View>

						{/* Products Section Header */}
						<View style={styles.sectionHeaderRow}>
							<Text style={styles.sectionTitle}>أحدث الخردوات والمنظفات والورقيات</Text>
						</View>

						{loading && (
							<View style={styles.centerContainer}>
								<ActivityIndicator size="large" color="#2D3C1F" />
								<Text style={styles.loadingText}>
									جاري تحميل الخردوات والمنظفات والورقيات...
								</Text>
							</View>
						)}
						{!loading && products.length === 0 && (
							<View style={styles.centerContainer}>
								<MaterialIcons name="inventory-2" size={48} color="#75786E" />
								<Text style={styles.emptyText}>
									لا توجد خردوات أو منظفات أو ورقيات متاحة حالياً
								</Text>
							</View>
						)}
					</>
				}
				renderItem={({ item }) => {
					if (!item) return null;
					const itemId = Number(item.id);
					const cartItem = cartItems.find((i) => Number(i.product_id || i.id) === itemId);
					const qtyInCart = cartItem?.quantity || 0;
					const displayPrice = (Number(item.price) || 0).toFixed(2);
					const isFav = favoriteIds.includes(itemId);

					return (
						<View style={[styles.productCard, { width: "48%", marginBottom: 0 }]}>
							<View style={styles.imagePlaceholder}>
								<TouchableOpacity
									style={styles.heartButton}
									hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
									onPress={() => handleToggleFavorite(itemId)}
								>
									<MaterialIcons
										name={isFav ? "favorite" : "favorite-border"}
										size={18}
										color={isFav ? "#BA1A1A" : "#75786E"}
									/>
								</TouchableOpacity>

								{item.unit ? (
									<View style={styles.unitBadge}>
										<Text style={styles.unitBadgeText} numberOfLines={1}>
											{item.unit}{item.number_of_items_in_unit && item.number_of_items_in_unit > 1 ? ` (${item.number_of_items_in_unit} قطعة)` : ''}
										</Text>
									</View>
								) : null}

								<AppImage
									uri={item.image_url}
									style={styles.productImage}
									iconName="shopping-basket"
									iconSize={36}
								/>
							</View>

							<Text style={styles.categoryName}>{item.category_name || "خردوات ومنظفات وورقيات"}</Text>
							<Text style={styles.productTitle} numberOfLines={2}>
								{item.name}
							</Text>

							{/* Purchase limit badge */}
							{item.max_app_order_quantity && item.max_app_order_quantity > 0 && (
								<View style={styles.limitBadge}>
									<MaterialIcons name="info-outline" size={10} color="#92400E" />
									<Text style={styles.limitBadgeText}>حد الشراء: {item.max_app_order_quantity}</Text>
								</View>
							)}

							<View style={styles.priceRow}>
								{(item as any).active_offer ? (
									<View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
										<Text style={styles.priceText}>{displayPrice} ج.م</Text>
										<Text style={styles.oldPriceText}>{(item as any).active_offer.original_price}</Text>
									</View>
								) : (
									<Text style={styles.priceText}>{displayPrice} ج.م</Text>
								)}
							</View>

							{qtyInCart === 0 ? (
								<TouchableOpacity
									style={styles.addButton}
									onPress={() => handleAddToCart(item)}
								>
									<Text style={styles.addButtonText}>+ إضافة للسلة</Text>
								</TouchableOpacity>
							) : (
								<View style={styles.qtyControlRow}>
									<TouchableOpacity
										style={styles.qtyBtn}
										onPress={() => handleUpdateCartQty(item.id, -1)}
									>
										<MaterialIcons name="remove" size={14} color="#1F1B13" />
									</TouchableOpacity>
									<Text style={styles.qtyNumber}>{qtyInCart}</Text>
									<TouchableOpacity
										style={styles.qtyBtnAdd}
										onPress={() => handleUpdateCartQty(item.id, 1)}
									>
										<MaterialIcons name="add" size={14} color="#FFF" />
									</TouchableOpacity>
								</View>
							)}
						</View>
					);
				}}
				ListFooterComponent={
					loadingMore ? (
						<View style={{ paddingVertical: 20, alignItems: "center", width: "100%" }}>
							<ActivityIndicator size="small" color="#2D3C1F" />
							<Text style={{ fontSize: 11, color: "#75786E", marginTop: 4, fontWeight: "600" }}>جاري تحميل المزيد من المنتجات...</Text>
						</View>
					) : null
				}
			/>

			{/* Sticky Footer Nav */}
			<MobileFooterNav cartCount={totalCartItems} wishlistCount={favoriteIds.length} />
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#FFF8F1",
	},
	header: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: "#EAE1D5",
		backgroundColor: "#FFF8F1",
	},
	brandTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#1F1B13",
	},
	greetingHeader: {
		flexDirection: "row-reverse",
		alignItems: "center",
		paddingHorizontal: 20,
		marginTop: 14,
		marginBottom: 10,
		gap: 12,
	},
	userAvatarBadge: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: "#D4EAB7",
		alignItems: "center",
		justifyContent: "center",
	},
	greetingTexts: {
		alignItems: "flex-end",
	},
	greetingTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#1F1B13",
	},
	greetingSub: {
		fontSize: 12,
		color: "#75786E",
		marginTop: 2,
	},
	heroCard: {
		marginHorizontal: 20,
		marginVertical: 10,
		borderRadius: 24,
		backgroundColor: "#2D3C1F",
		padding: 20,
		overflow: "hidden",
	},
	heroContent: {
		alignItems: "flex-end",
	},
	heroTitle: {
		color: "#FFF",
		fontSize: 18,
		fontWeight: "bold",
		textAlign: "right",
	},
	heroSub: {
		color: "#BACDA5",
		fontSize: 12,
		marginTop: 4,
		marginBottom: 14,
		textAlign: "right",
	},
	heroCtaBtn: {
		backgroundColor: "#455330",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 9999,
	},
	heroCtaText: {
		color: "#FFF",
		fontSize: 12,
		fontWeight: "bold",
	},
	searchContainer: {
		paddingHorizontal: 20,
		marginVertical: 8,
	},
	searchInput: {
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#EAE1D5",
		borderRadius: 16,
		paddingHorizontal: 16,
		paddingVertical: 12,
		fontSize: 13,
		color: "#1F1B13",
		textAlign: "right",
	},
	sectionHeaderRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		marginTop: 14,
		marginBottom: 8,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#1F1B13",
	},
	seeAllText: {
		fontSize: 13,
		color: "#2D3C1F",
		fontWeight: "bold",
	},
	categoriesWrapper: {
		marginBottom: 12,
	},
	categoriesContainer: {
		paddingHorizontal: 20,
		gap: 16,
	},
	categoryItem: {
		alignItems: "center",
		width: 70,
	},
	categoryItemActive: {},
	categoryIconCircle: {
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: "#FBF2E5",
		borderWidth: 1,
		borderColor: "#EAE1D5",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 6,
	},
	categoryItemLabel: {
		fontSize: 11,
		fontWeight: "600",
		color: "#45483F",
		textAlign: "center",
	},
	mainScrollView: {
		flex: 1,
	},
	productsGrid: {
		flexDirection: "row-reverse",
		flexWrap: "wrap",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingBottom: 20,
	},
	productCard: {
		width: "48%",
		backgroundColor: "#FFF",
		borderRadius: 20,
		padding: 12,
		borderWidth: 1,
		borderColor: "#EAE1D5",
		marginBottom: 14,
	},
	imagePlaceholder: {
		width: "100%",
		height: 120,
		backgroundColor: "#F6EDE0",
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 8,
		position: "relative",
		overflow: "hidden",
	},
	heartButton: {
		position: "absolute",
		top: 6,
		left: 6,
		width: 28,
		height: 28,
		borderRadius: 14,
		backgroundColor: "rgba(255, 255, 255, 0.9)",
		alignItems: "center",
		justifyContent: "center",
		zIndex: 10,
	},
	unitBadge: {
		position: "absolute",
		top: 6,
		right: 6,
		backgroundColor: "rgba(255, 255, 255, 0.95)",
		paddingHorizontal: 7,
		paddingVertical: 3,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#EAE1D5",
		zIndex: 10,
	},
	unitBadgeText: {
		fontSize: 10,
		fontWeight: "700",
		color: "#2D3C1F",
		textAlign: "right",
	},
	productImage: {
		width: "100%",
		height: "100%",
		borderRadius: 16,
	},
	categoryName: {
		fontSize: 10,
		color: "#75786E",
		fontWeight: "600",
		textAlign: "right",
	},
	productTitle: {
		fontSize: 13,
		fontWeight: "bold",
		color: "#1F1B13",
		textAlign: "right",
		marginVertical: 2,
	},
	priceRow: {
		flexDirection: "row-reverse",
		justifyContent: "space-between",
		alignItems: "baseline",
		marginVertical: 4,
	},
	priceText: {
		fontSize: 15,
		fontWeight: "bold",
		color: "#1F1B13",
	},
	addButton: {
		backgroundColor: "#2D3C1F",
		paddingVertical: 8,
		borderRadius: 9999,
		alignItems: "center",
		marginTop: 4,
	},
	addButtonText: {
		color: "#FFF",
		fontSize: 11,
		fontWeight: "bold",
	},
	qtyControlRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		backgroundColor: "#F6EDE0",
		borderRadius: 12,
		padding: 4,
		marginTop: 4,
	},
	qtyBtn: {
		width: 26,
		height: 26,
		borderRadius: 8,
		backgroundColor: "#FFF",
		alignItems: "center",
		justifyContent: "center",
	},
	qtyBtnAdd: {
		width: 26,
		height: 26,
		borderRadius: 8,
		backgroundColor: "#2D3C1F",
		alignItems: "center",
		justifyContent: "center",
	},
	qtyNumber: {
		fontSize: 13,
		fontWeight: "bold",
		color: "#1F1B13",
	},
	centerContainer: {
		alignItems: "center",
		justifyContent: "center",
		padding: 40,
	},
	loadingText: {
		marginTop: 10,
		fontSize: 13,
		color: "#75786E",
	},
	emptyText: {
		marginTop: 10,
		fontSize: 14,
		color: "#75786E",
	},
	// ── Offer Styles ──
	offerCard: {
		width: 140,
		backgroundColor: "#FFF",
		borderRadius: 16,
		padding: 10,
		borderWidth: 1,
		borderColor: "#EAE1D5",
		position: "relative",
	},
	offerDiscountBadge: {
		position: "absolute",
		top: 8,
		left: 8,
		backgroundColor: "#BA1A1A",
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 8,
		zIndex: 10,
	},
	offerDiscountText: {
		color: "#FFF",
		fontSize: 10,
		fontWeight: "bold",
	},
	offerImage: {
		width: "100%",
		height: 80,
		borderRadius: 12,
		marginBottom: 6,
	},
	offerProductName: {
		fontSize: 11,
		fontWeight: "bold",
		color: "#1F1B13",
		textAlign: "right",
		marginBottom: 4,
	},
	offerNewPrice: {
		fontSize: 13,
		fontWeight: "bold",
		color: "#2D3C1F",
	},
	offerOldPrice: {
		fontSize: 11,
		color: "#BA1A1A",
		textDecorationLine: "line-through",
	},
	offerLimitText: {
		fontSize: 9,
		color: "#92400E",
		fontWeight: "600",
		textAlign: "right",
		marginTop: 2,
	},
	// ── Purchase Limit Badge ──
	limitBadge: {
		flexDirection: "row-reverse",
		alignItems: "center",
		gap: 3,
		backgroundColor: "#FEF3C7",
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 6,
		alignSelf: "flex-end",
		marginVertical: 2,
	},
	limitBadgeText: {
		fontSize: 9,
		color: "#92400E",
		fontWeight: "700",
	},
	// ── Old Price (strikethrough) ──
	oldPriceText: {
		fontSize: 11,
		color: "#BA1A1A",
		textDecorationLine: "line-through",
		fontWeight: "600",
	},
});
