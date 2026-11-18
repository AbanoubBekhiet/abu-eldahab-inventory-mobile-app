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
	DeviceEventEmitter,
	LayoutAnimation,
	Platform,
	UIManager,
} from "react-native";
import Toast from 'react-native-toast-message';
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
	fetchUnreadNotificationsCount,
	getSettingsLogoUrl,
	Product,
	Category,
	CartItem,
	User,
	OfferItem,
} from "../services/api";
import { setActiveAppMode } from "../services/app-mode";
import MobileFooterNav from "../components/mobile-footer";
import { AppImage } from "../components/app-image";
import { useRoleGuard } from "../hooks/useRoleGuard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

	// Unread Notifications Count
	const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

	// Logo URL
	const logoUrl = getSettingsLogoUrl();

	// Offers Carousel Auto-Advance State & Refs
	const offersCarouselRef = React.useRef<FlatList>(null);
	const carouselTimerRef = React.useRef<any>(null);
	const activeOfferIndexRef = React.useRef(0);
	const isUserInteractingRef = React.useRef(false);
	const [activeOfferIndex, setActiveOfferIndex] = useState(0);

	const startOffersCarouselTimer = useCallback(() => {
		if (carouselTimerRef.current) {
			clearInterval(carouselTimerRef.current);
			carouselTimerRef.current = null;
		}
		if (activeOffers.length <= 1) return;

		carouselTimerRef.current = setInterval(() => {
			if (isUserInteractingRef.current) return;
			if (activeOffers.length <= 1) return;

			const currentIdx = activeOfferIndexRef.current;
			const nextIdx = (currentIdx + 1) % activeOffers.length;

			activeOfferIndexRef.current = nextIdx;
			try {
				LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
			} catch (_) {}
			setActiveOfferIndex(nextIdx);

			offersCarouselRef.current?.scrollToIndex({
				index: nextIdx,
				animated: true,
			});
		}, 3000); // 3 seconds interval for smooth transition
	}, [activeOffers.length]);

	const stopOffersCarouselTimer = useCallback(() => {
		if (carouselTimerRef.current) {
			clearInterval(carouselTimerRef.current);
			carouselTimerRef.current = null;
		}
	}, []);

	// Keep activeOfferIndexRef in sync with state
	useEffect(() => {
		activeOfferIndexRef.current = activeOfferIndex;
	}, [activeOfferIndex]);

	// Auto-start carousel timer whenever activeOffers changes
	useEffect(() => {
		startOffersCarouselTimer();
		return () => stopOffersCarouselTimer();
	}, [startOffersCarouselTimer, stopOffersCarouselTimer]);

	const onViewableItemsChanged = useCallback(
		({ viewableItems }: { viewableItems: any[] }) => {
			if (viewableItems && viewableItems.length > 0 && viewableItems[0].index != null) {
				const idx = viewableItems[0].index;
				if (activeOfferIndexRef.current !== idx) {
					try {
						LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
					} catch (_) {}
					setActiveOfferIndex(idx);
					activeOfferIndexRef.current = idx;
				}
			}
		},
		[]
	);
	const viewabilityConfig = React.useRef({
		itemVisiblePercentThreshold: 60,
	}).current;

	// Refresh cart + favorites + notifications count every time screen is focused
	useFocusEffect(
		useCallback(() => {
			let active = true;
			const loadData = async () => {
				try {
					const [user, cats, favs, cart, offers, unreadCount] = await Promise.all([
						fetchUserProfile(),
						fetchCategories(),
						getFavoriteIds(),
						getCartItems(),
						fetchActiveOffers(),
						fetchUnreadNotificationsCount(),
					]);
					if (!active) return;
					if (user) setUserProfile(user);
					setCategories(Array.isArray(cats) ? cats : []);
					setFavoriteIds(Array.isArray(favs) ? [...favs.map(Number)] : []);
					setCartItems(Array.isArray(cart) ? [...cart] : []);
					setActiveOffers(Array.isArray(offers) ? offers : []);
					setUnreadNotificationsCount(unreadCount || 0);
				} catch (e) {
					if (!active) return;
					setCategories([]);
				}
			};
			loadData();
			startOffersCarouselTimer();

			return () => {
				active = false;
				stopOffersCarouselTimer();
			};
		}, [startOffersCarouselTimer, stopOffersCarouselTimer])
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
					const [user, cats, favs, cart, offers, unreadCount] = await Promise.all([
						fetchUserProfile(),
						fetchCategories(),
						getFavoriteIds(),
						getCartItems(),
						fetchActiveOffers(),
						fetchUnreadNotificationsCount(),
					]);
					if (user) setUserProfile(user);
					setCategories(Array.isArray(cats) ? cats : []);
					setFavoriteIds(Array.isArray(favs) ? [...favs.map(Number)] : []);
					setCartItems(Array.isArray(cart) ? [...cart] : []);
					setActiveOffers(Array.isArray(offers) ? offers : []);
					setUnreadNotificationsCount(unreadCount || 0);
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
		let isAdding = true;
		// Optimistic update
		setFavoriteIds((prev) => {
			if (prev.includes(pId)) {
				isAdding = false;
				return prev.filter((id) => id !== pId);
			}
			return [...prev, pId];
		});

		if (isAdding) {
			Toast.show({ type: 'success', text1: 'المفضلة', text2: 'تم إضافة المنتج للمفضلة' });
		} else {
			Toast.show({ type: 'info', text1: 'المفضلة', text2: 'تم إزالة المنتج من المفضلة' });
		}

		// Persist to storage
		const updated = await toggleFavoriteId(pId);
		setFavoriteIds([...updated.map(Number)]);
	};

	const handleAddToCart = async (product: Product) => {
		if (!product || !product.id) return;
		const targetId = Number(product.id);
		const existing = cartItems.find((i) => Number(i.product_id) === targetId);
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
				Toast.show({
					type: 'error',
					text1: 'حد الكمية المسموحة',
					text2: `عذراً، أقصى كمية مسموح بشرائها هي ${maxAllowedNum} قطعة فقط.`
				});
				return;
			}
		}

		// Optimistic update
		setCartItems((prev) => {
			const idx = prev.findIndex((i) => Number(i.product_id) === targetId);
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
						is_offer: false,
					},
				];
			}
		});

		// Persist to storage
		const updatedCart = await addProductToCart(product, 1, {
			isOffer: false,
			unitPrice: Number(product.price) || 0,
		});
		setCartItems([...updatedCart]);
		Toast.show({ type: 'success', text1: 'السلة', text2: 'تم إضافة المنتج للسلة بنجاح' });
	};

	const handleUpdateCartQty = async (productId: number | string, delta: number) => {
		const pId = Number(productId);
		const existing = cartItems.find((i) => Number(i.product_id) === pId);

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
				Toast.show({
					type: 'error',
					text1: 'حد الكمية المسموحة',
					text2: `عذراً، أقصى كمية مسموح بشرائها هي ${maxAllowedNum} قطعة فقط.`
				});
				return;
			}
		}

		// Optimistic update
		setCartItems((prev) => {
			const updated = prev
				.map((item) => {
					if (Number(item.product_id) === pId) {
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
		if (delta > 0) {
			Toast.show({ type: 'success', text1: 'السلة', text2: 'تم زيادة الكمية' });
		} else {
			Toast.show({ type: 'info', text1: 'السلة', text2: 'تم إنقاص الكمية' });
		}
	};

	const totalCartItems = cartItems.length;

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
						{/* Greeting Header with App Logo, User Name & Notification Bell */}
						<View style={styles.greetingHeader}>
							<View style={styles.greetingRight}>
								<View style={styles.userAvatarBadge}>
									<Image
										source={require('../../assets/images/default_logo.jpeg')}
										style={{ width: 40, height: 40, borderRadius: 20 }}
										resizeMode="contain"
									/>
								</View>
								<View style={styles.greetingTexts}>
									<Text style={styles.greetingTitle}>
										{userProfile?.name ? `أهلاً بك ${userProfile.name}` : "مرحباً بك في تطبيق أبو الدهب"}
									</Text>
									<Text style={styles.greetingSub}>
										{userProfile?.shop_name || "جاهز لتسوق الخردوات والمنظفات والورقيات اليوم؟"}
									</Text>
								</View>
							</View>

							<TouchableOpacity
								style={styles.notificationBellBtn}
								onPress={() => router.push('/notifications')}
								activeOpacity={0.7}
							>
								<MaterialIcons name="notifications-none" size={24} color="#1A2D23" />
								{unreadNotificationsCount > 0 && (
									<View style={styles.bellBadge}>
										<Text style={styles.bellBadgeText}>
											{unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
										</Text>
									</View>
								)}
							</TouchableOpacity>
						</View>

						{/* Admin Mode Notice & Return Bar */}
						{isAdminOrSubAdmin(userProfile) && (
							<TouchableOpacity
								style={styles.adminModeNoticeBar}
								onPress={() => {
									Alert.alert(
										'لوحة الإدارة',
										'أنت تتصفح بوضع العميل. هل تريد العودة إلى لوحة تحكم الأدمن؟',
										[
											{ text: 'إلغاء', style: 'cancel' },
											{
												text: 'العودة للإدارة 👑',
												style: 'default',
												onPress: async () => {
													await setActiveAppMode('admin');
													router.replace('/admin');
												},
											},
										]
									);
								}}
								activeOpacity={0.8}
							>
								<View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
									<View style={styles.adminCrownCircle}>
										<MaterialIcons name="admin-panel-settings" size={18} color="#FFFFFF" />
									</View>
									<View style={{ alignItems: 'flex-end' }}>
										<Text style={styles.adminModeNoticeTitle}>أنت تتصفح بوضع العميل 🛍️</Text>
										<Text style={styles.adminModeNoticeSub}>اضغط هنا للعودة إلى لوحة تحكم الأدمن</Text>
									</View>
								</View>
								<View style={styles.adminModeNoticeBtn}>
									<MaterialIcons name="dashboard" size={14} color="#1E3E2B" />
									<Text style={styles.adminModeNoticeBtnText}>لوحة الإدارة</Text>
								</View>
							</TouchableOpacity>
						)}

						{/* Offers Carousel / FMCG Wholesale Banner */}
						{activeOffers.length > 0 ? (
							<View style={{ marginVertical: 10 }}>
								<FlatList
									ref={offersCarouselRef}
									data={activeOffers}
									keyExtractor={(item) => String(item.id)}
									horizontal
									pagingEnabled
									decelerationRate="fast"
									snapToInterval={SCREEN_WIDTH}
									snapToAlignment="center"
									showsHorizontalScrollIndicator={false}
									scrollEventThrottle={16}
									removeClippedSubviews={false}
									initialNumToRender={activeOffers.length || 5}
									maxToRenderPerBatch={activeOffers.length || 5}
									windowSize={activeOffers.length + 1}
									onViewableItemsChanged={onViewableItemsChanged}
									viewabilityConfig={viewabilityConfig}
									getItemLayout={(_, index) => ({
										length: SCREEN_WIDTH,
										offset: SCREEN_WIDTH * index,
										index,
									})}
									onScrollToIndexFailed={(info) => {
										setTimeout(() => {
											offersCarouselRef.current?.scrollToOffset({
												offset: info.index * SCREEN_WIDTH,
												animated: true,
											});
										}, 50);
									}}
									onScrollBeginDrag={() => {
										isUserInteractingRef.current = true;
										stopOffersCarouselTimer();
									}}
									onScrollEndDrag={() => {
										isUserInteractingRef.current = false;
										startOffersCarouselTimer();
									}}
									onMomentumScrollEnd={(e) => {
										isUserInteractingRef.current = false;
										const offset = e.nativeEvent.contentOffset.x;
										const idx = Math.round(offset / SCREEN_WIDTH);
										if (idx >= 0 && idx < activeOffers.length) {
											if (activeOfferIndexRef.current !== idx) {
												try {
													LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
												} catch (_) {}
												setActiveOfferIndex(idx);
												activeOfferIndexRef.current = idx;
											}
										}
										startOffersCarouselTimer();
									}}
									renderItem={({ item }) => (
										<View style={{ width: SCREEN_WIDTH }}>
											<TouchableOpacity
												style={[styles.heroCard, { marginHorizontal: 20, marginVertical: 0, padding: 0 }]}
												onPress={() => router.push('/offers')}
												activeOpacity={0.92}
											>
												<View style={{ position: 'absolute', inset: 0, backgroundColor: '#1D2A14' }}>
													<AppImage
														uri={item.product_image_url}
														style={{ width: '100%', height: '100%', opacity: 0.35 }}
														iconName="local-offer"
														iconSize={40}
													/>
												</View>

												{/* Top Tag Row */}
												<View style={styles.offerCardTopBar}>
													<View style={styles.offerDiscountBadge}>
														<MaterialIcons name="local-offer" size={12} color="#FFF" />
														<Text style={styles.offerDiscountText}>خصم {item.discount_percentage}%</Text>
													</View>
												</View>

												<View style={[styles.heroContent, { zIndex: 1, padding: 18, paddingTop: 46 }]}>
													<Text style={styles.heroTitle} numberOfLines={2}>{item.product_name}</Text>
													<View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 12 }}>
														<Text style={{ color: '#FFF', fontSize: 24, fontWeight: 'bold' }}>{item.offer_price} ج.م</Text>
														<Text style={{ color: '#BACDA5', fontSize: 15, textDecorationLine: 'line-through' }}>{item.original_price} ج.م</Text>
														{Number(item.original_price) > Number(item.offer_price) && (
															<View style={styles.savingsPill}>
																<Text style={styles.savingsPillText}>
																	وفر {(Number(item.original_price) - Number(item.offer_price)).toFixed(0)} ج
																</Text>
															</View>
														)}
													</View>
													<View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', width: '100%' }}>
														<TouchableOpacity
															style={styles.heroCtaBtn}
															onPress={() => router.push('/offers')}
															activeOpacity={0.85}
														>
															<Text style={styles.heroCtaText}>تسوق العرض الآن</Text>
															<MaterialIcons name="arrow-back-ios" size={12} color="#FFF" />
														</TouchableOpacity>
													</View>
												</View>
											</TouchableOpacity>
										</View>
									)}
								/>
								{activeOffers.length > 1 && (
									<View style={styles.dotsContainer}>
										{activeOffers.map((_, idx) => (
											<TouchableOpacity
												key={idx}
												onPress={() => {
													try {
														LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
													} catch (_) {}
													offersCarouselRef.current?.scrollToIndex({ index: idx, animated: true });
													setActiveOfferIndex(idx);
													activeOfferIndexRef.current = idx;
													startOffersCarouselTimer();
												}}
												hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
												style={[
													styles.dot,
													activeOfferIndex === idx ? styles.dotActive : styles.dotInactive,
												]}
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
										activeOpacity={0.85}
									>
										<Text style={styles.heroCtaText}>تسوق العروض الآن</Text>
										<MaterialIcons name="arrow-back-ios" size={12} color="#FFF" />
									</TouchableOpacity>
								</View>
							</View>
						)}


						{/* Categories Horizontal Slider */}
						<View style={styles.sectionHeaderRow}>
							<TouchableOpacity onPress={() => router.push('/explore')}>
								<Text style={styles.seeAllText}>عرض الكل</Text>
							</TouchableOpacity>
							<Text style={styles.sectionTitle}>الأقسام والفئات</Text>
						</View>

						<View style={styles.categoriesWrapper}>
							<View style={styles.categoriesContainer}>
								<TouchableOpacity
									style={[
										styles.categoryItem,
										selectedCategory === "all" && styles.categoryItemActive,
									]}
									onPress={() => router.push({ pathname: '/explore', params: { categoryId: 'all' } })}
								>
									<View style={styles.categoryIconCircle}>
										<MaterialIcons name="shopping-basket" size={32} color="#2D3C1F" />
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
										onPress={() => router.push({ pathname: '/explore', params: { categoryId: cat.id } })}
									>
										<AppImage
											uri={cat.image_url}
											style={styles.categoryIconCircle}
											iconName="shopping-basket"
											iconSize={48}
										/>
										<Text style={styles.categoryItemLabel} numberOfLines={1}>{cat.name}</Text>
									</TouchableOpacity>
								))}
							</View>
						</View>

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
					const cartItem = cartItems.find((i) => Number(i.product_id) === itemId);
					const qtyInCart = cartItem?.quantity || 0;
					const displayPrice = (Number(item.price) || 0).toFixed(2);
					const isFav = favoriteIds.includes(itemId);
					const isOutOfStock = Number(item.stock) <= 0;

					return (
						<View style={[styles.productCard, { width: "48%", marginBottom: 0 }]}>
							{/* Card Header: Unit Badge & Favorite Heart Button above the image */}
							<View style={styles.cardHeaderRow}>
								{item.unit ? (
									<View style={styles.unitBadge}>
										<Text style={styles.unitBadgeText} numberOfLines={1}>
											{item.unit}{item.number_of_items_in_unit && item.number_of_items_in_unit > 1 ? ` (${item.number_of_items_in_unit} قطعة)` : ''}
										</Text>
									</View>
								) : <View style={{ width: 1 }} />}

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
							</View>

							<View style={styles.imagePlaceholder}>
								<AppImage
									uri={item.image_url}
									style={[styles.productImage, isOutOfStock && { opacity: 0.4 }]}
									iconName="shopping-basket"
									iconSize={36}
								/>
								{isOutOfStock && (
									<View style={styles.outOfStockOverlay}>
										<Text style={styles.outOfStockText}>نفذت الكمية</Text>
									</View>
								)}
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
								<Text style={styles.priceText}>{displayPrice} ج.م</Text>
							</View>

							{qtyInCart === 0 ? (
								<TouchableOpacity
									style={[styles.addButton, isOutOfStock && { backgroundColor: '#EAE1D5', borderColor: '#EAE1D5' }]}
									onPress={() => handleAddToCart(item)}
									disabled={isOutOfStock}
								>
									<Text style={[styles.addButtonText, isOutOfStock && { color: '#75786E' }]}>
										{isOutOfStock ? 'غير متوفر' : '+ إضافة للسلة'}
									</Text>
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
		justifyContent: "space-between",
		paddingHorizontal: 20,
		marginTop: 14,
		marginBottom: 10,
	},
	greetingRight: {
		flexDirection: "row-reverse",
		alignItems: "center",
		gap: 12,
		flex: 1,
	},
	notificationBellBtn: {
		width: 44,
		height: 44,
		borderRadius: 14,
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#EAE8E2",
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 3,
		elevation: 1,
	},
	bellBadge: {
		position: "absolute",
		top: -4,
		right: -4,
		backgroundColor: "#BA1A1A",
		borderRadius: 10,
		minWidth: 18,
		height: 18,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 4,
		borderWidth: 1.5,
		borderColor: "#FFFFFF",
	},
	bellBadgeText: {
		color: "#FFFFFF",
		fontSize: 10,
		fontWeight: "bold",
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
	adminModeNoticeBar: {
		flexDirection: "row-reverse",
		alignItems: "center",
		justifyContent: "space-between",
		marginHorizontal: 20,
		marginBottom: 12,
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 16,
		backgroundColor: "#FFFFFF",
		borderWidth: 1.5,
		borderColor: "#D4EAB7",
		shadowColor: "#1E3E2B",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.07,
		shadowRadius: 4,
		elevation: 2,
	},
	adminCrownCircle: {
		width: 34,
		height: 34,
		borderRadius: 17,
		backgroundColor: "#1E3E2B",
		alignItems: "center",
		justifyContent: "center",
	},
	adminModeNoticeTitle: {
		fontSize: 12,
		fontWeight: "bold",
		color: "#1A2D23",
	},
	adminModeNoticeSub: {
		fontSize: 10,
		color: "#7C7870",
		marginTop: 1,
	},
	adminModeNoticeBtn: {
		flexDirection: "row-reverse",
		alignItems: "center",
		gap: 4,
		backgroundColor: "#EEF4F1",
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#D0E2D8",
	},
	adminModeNoticeBtnText: {
		fontSize: 11,
		fontWeight: "bold",
		color: "#1E3E2B",
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
		flexDirection: "row-reverse",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
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
		flexDirection: "row-reverse",
		flexWrap: "wrap",
		justifyContent: "space-between",
		rowGap: 14,
	},
	categoryItem: {
		alignItems: "center",
		width: "48%",
		marginBottom: 4,
	},
	categoryItemActive: {},
	categoryIconCircle: {
		width: "100%",
		height: 115,
		borderRadius: 18,
		backgroundColor: "#FBF2E5",
		borderWidth: 1,
		borderColor: "#EAE1D5",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 8,
		overflow: "hidden",
	},
	categoryItemLabel: {
		fontSize: 13,
		fontWeight: "700",
		color: "#1F1B13",
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
	cardHeaderRow: {
		flexDirection: "row-reverse",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 8,
		width: "100%",
		minHeight: 28,
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
		width: 28,
		height: 28,
		borderRadius: 14,
		backgroundColor: "#FBF2E5",
		borderWidth: 1,
		borderColor: "#EAE1D5",
		alignItems: "center",
		justifyContent: "center",
	},
	unitBadge: {
		backgroundColor: "#EBF5E0",
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#D4EAB7",
		alignItems: "center",
		justifyContent: "center",
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
	offerCardTopBar: {
		position: 'absolute',
		top: 14,
		left: 16,
		right: 16,
		flexDirection: 'row-reverse',
		justifyContent: 'space-between',
		alignItems: 'center',
		zIndex: 10,
	},
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
		flexDirection: 'row-reverse',
		alignItems: 'center',
		gap: 4,
		backgroundColor: "#BA1A1A",
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 8,
		zIndex: 10,
	},
	offerDiscountText: {
		color: "#FFF",
		fontSize: 11,
		fontWeight: "bold",
	},
	offerFlameBadge: {
		flexDirection: 'row-reverse',
		alignItems: 'center',
		gap: 4,
		backgroundColor: 'rgba(0, 0, 0, 0.45)',
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 8,
		borderWidth: 0.5,
		borderColor: 'rgba(255, 255, 255, 0.25)',
	},
	offerFlameText: {
		color: '#FFF',
		fontSize: 10,
		fontWeight: 'bold',
	},
	savingsPill: {
		backgroundColor: 'rgba(186, 26, 26, 0.25)',
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: '#BA1A1A',
	},
	savingsPillText: {
		color: '#FFB4AB',
		fontSize: 11,
		fontWeight: 'bold',
	},
	autoAdvanceIndicator: {
		flexDirection: 'row-reverse',
		alignItems: 'center',
		gap: 4,
		opacity: 0.85,
	},
	autoAdvanceText: {
		color: '#BACDA5',
		fontSize: 10,
	},
	dotsContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		marginTop: 10,
		gap: 6,
	},
	dot: {
		height: 8,
		borderRadius: 4,
	},
	dotActive: {
		width: 24,
		backgroundColor: '#2D3C1F',
	},
	dotInactive: {
		width: 8,
		backgroundColor: '#D4EAB7',
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
	outOfStockOverlay: {
		position: 'absolute',
		top: '40%',
		left: 0,
		right: 0,
		backgroundColor: 'rgba(186, 26, 26, 0.8)',
		paddingVertical: 4,
		alignItems: 'center',
		transform: [{ rotate: '-10deg' }],
	},
	outOfStockText: {
		color: '#FFFFFF',
		fontWeight: 'bold',
		fontSize: 14,
	},
});
