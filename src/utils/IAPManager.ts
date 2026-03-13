import { Platform, Alert } from 'react-native';
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  acknowledgePurchaseAndroid,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
  consumePurchase,
  type Product,
  type Subscription,
  type Purchase,
} from 'react-native-iap';

// Product IDs cho Google Play Store và App Store
// THAY ĐỔI CÁC ID NÀY THÀNH ID THỰC TẾ TRONG GOOGLE PLAY CONSOLE
export const IAP_PRODUCTS = {
  // One-time purchases
  IAP_LIFETIME: Platform.select({
    android: 'com.timewarpscan.lifetime',
    ios: 'com.timewarpscan.lifetime',
  }),

  // Subscriptions
  SUBSCRIPTION: Platform.select({
    android: 'com.timewarpscan.sub',
    ios: 'com.timewarpscan.sub',
  })
};

// Debug log products
console.log('🔧 IAP_PRODUCTS:', IAP_PRODUCTS);
console.log('🔧 Platform:', Platform.OS);

// Cấu hình subscription
export const SUBSCRIPTION_IDS = [
  IAP_PRODUCTS.SUBSCRIPTION
].filter(Boolean) as string[];

// Cấu hình one-time purchase
export const ONE_TIME_PURCHASE_IDS = [
  IAP_PRODUCTS.IAP_LIFETIME,
].filter(Boolean) as string[];

// Debug log IDs
console.log('🔧 SUBSCRIPTION_IDS after filter:', SUBSCRIPTION_IDS);
console.log('🔧 ONE_TIME_PURCHASE_IDS after filter:', ONE_TIME_PURCHASE_IDS);

class IAPManager {
  private static instance: IAPManager;
  private inappLeftTime: Product[] = [];
  private subscriptions: Subscription[] = [];
  private isInitialized = false;
  private isVip = false;
  private ownedProductIds: Set<string> = new Set();
  private purchaseSuccessCallbacks: ((purchase: Purchase) => void)[] = [];
  private purchaseErrorCallbacks: ((error: any) => void)[] = [];

  private constructor() { }

  public static getInstance(): IAPManager {
    if (!IAPManager.instance) {
      IAPManager.instance = new IAPManager();
    }
    return IAPManager.instance;
  }

  // Khởi tạo IAP
  public async initialize(): Promise<boolean> {
    try {
      console.log('🚀 Initializing IAP...');
      const result = await initConnection();

      if (result) {
        console.log('✅ IAP initialized successfully');
        this.isInitialized = true;

        // Test connection first
        await this.testConnection();

        // Load in-app và subscriptions
        await this.loadInApp();
        await this.loadSubscriptions();

        // Setup listeners
        this.setupListeners();

        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ IAP initialization error:', error);
      return false;
    }
  }

  // Load products (one-time purchases)
  private async loadInApp(): Promise<void> {
    try {
      if (ONE_TIME_PURCHASE_IDS.length > 0) {
        const result = await fetchProducts({
          skus: ONE_TIME_PURCHASE_IDS,
          type: 'in-app'
        });
        this.inappLeftTime = result || [];
      }
    } catch (error) {
      this.inappLeftTime = [];
    }
  }

  // Load subscriptions
  private async loadSubscriptions(): Promise<void> {
    try {
      console.log('🔧 SUBSCRIPTION_IDS:', SUBSCRIPTION_IDS);
      console.log('🔧 SUBSCRIPTION_IDS length:', SUBSCRIPTION_IDS.length);
      
      if (SUBSCRIPTION_IDS.length > 0) {
        console.log('📋 Loading subscriptions with IDs:', SUBSCRIPTION_IDS);
        const result = await fetchProducts({
          skus: SUBSCRIPTION_IDS,
          type: 'subs'
        });
        // Cast to unknown first, then to Subscription[]
        this.subscriptions = (result as unknown as Subscription[]) || [];
        console.log('✅ Subscriptions loaded:', this.subscriptions);
        console.log('✅ Subscriptions count:', this.subscriptions.length);
      } else {
        console.log('⚠️ No subscription IDs configured');
        this.subscriptions = [];
      }
    } catch (error) {
      console.error('❌ Error loading subscriptions:', error);
      this.subscriptions = [];
    }
  }

  // Setup purchase listeners
  private setupListeners(): void {
    // Purchase updated listener
    purchaseUpdatedListener((purchase: Purchase) => {
      this.handlePurchaseUpdate(purchase);
    });

    // Purchase error listener
    purchaseErrorListener((error: any) => {
      if (error.code === 'ITEM_ALREADY_OWNED' || error.responseCode === 7) {
        console.log('ℹ️ Item already owned');
      } else if (error.code === 'USER_CANCELED' || error.responseCode === 1) {
        console.log('ℹ️ User canceled purchase');
      } else if (error.code === 'ITEM_UNAVAILABLE' || error.responseCode === 4) {
        console.log('❌ Item not available for purchase');
      } else {
        console.log('❌ Unknown purchase error:', error);
      }
      
      // Call all registered error callbacks
      this.purchaseErrorCallbacks.forEach(callback => {
        try {
          callback(error);
        } catch (callbackError) {
          console.error('❌ Error in purchase error callback:', callbackError);
        }
      });
    });
  }

  // Handle purchase update
  private async handlePurchaseUpdate(purchase: Purchase): Promise<void> {
    try {
      await this.processPurchaseReward(purchase);

      const isOneTimePurchase = ONE_TIME_PURCHASE_IDS.includes(purchase.productId);
      const isSubscription = SUBSCRIPTION_IDS.includes(purchase.productId);
      const requiresAcknowledgement = isOneTimePurchase || isSubscription;

      // Acknowledge purchases that require it on Android (non-consumables & subscriptions)
      if (Platform.OS === 'android' && requiresAcknowledgement) {
        await this.acknowledgePurchaseIfNeeded(purchase);
      }

      // Check if it's a one-time purchase (consumable) or subscription
      const isConsumablePurchase = !(requiresAcknowledgement);

      await finishTransaction({
        purchase,
        isConsumable: isConsumablePurchase,
      });
    } catch (error) {
      console.log('❌ Error processing transaction:', error);
    }
  }

  private async acknowledgePurchaseIfNeeded(purchase: Purchase): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    const token = purchase.purchaseToken;
    if (!token) {
      console.warn('⚠️ Cannot acknowledge purchase without token:', purchase.productId);
      return;
    }

    // Check if purchase has Android-specific properties
    const androidPurchase = purchase as any;
    if (androidPurchase.isAcknowledgedAndroid) {
      console.log('ℹ️ Purchase already acknowledged:', purchase.productId);
      return;
    }

    try {
      await acknowledgePurchaseAndroid(token);
      console.log('✅ Purchase acknowledged on Android:', purchase.productId);
    } catch (error: any) {
      const errorMessage = error?.message ?? String(error);
      console.warn('⚠️ Failed to acknowledge purchase, will rely on finishTransaction fallback:', errorMessage);
    }
  }

  // Process purchase reward
  private async processPurchaseReward(purchase: Purchase): Promise<void> {
    try {
      Alert.alert('Purchase success');
      this.isVip = true;
      
      // Update VIP Manager
      const VIPManager = require('./VIPManager').default;
      const vipManager = VIPManager.getInstance();
      await vipManager.setVipStatus(true);
      
      // Call all registered success callbacks
      this.purchaseSuccessCallbacks.forEach(callback => {
        try {
          callback(purchase);
        } catch (error) {
          console.error('❌ Error in purchase success callback:', error);
        }
      });
      
    } catch (error) {
      console.log('❌ Error processing reward:', error);
    }
  }

  // Get all products
  public getInApp(): Product[] {
    return this.inappLeftTime;
  }

  // Get all subscriptions
  public getSubscriptions(): Subscription[] {
    return this.subscriptions;
  }

  public getIsVip(): boolean {
    return this.isVip;
  }

  public isLifetimeOwned(): boolean {
    return this.ownedProductIds.has(IAP_PRODUCTS.IAP_LIFETIME as string);
  }

  // Check if the user has any purchases and update the isVip status
  public async refreshEntitlements(): Promise<void> {
    try {
      const purchases = await getAvailablePurchases();
      // isVip nếu có lifetime hoặc có sub trong danh sách
      this.ownedProductIds = new Set((purchases || []).map(p => p.productId));
      this.isVip = purchases.length > 0;
    } catch (e) {
      console.log('❌ refreshEntitlements error:', e);
    }
  }

  public async requestPurchaseWithOffer(productId: string, offerToken: string, basePlanId?: string): Promise<void> {
    return this.purchase(productId, { offerToken, isOfferPersonalized: false });
  }

  // Request purchase (event-based)
  public async requestPurchase(productId: string, basePlanId?: string): Promise<void> {
    return this.purchase(productId, { isOfferPersonalized: false });
  }

  // Unified purchase method
  public async purchase(
    productId: string,
    options?: { offerToken?: string; isOfferPersonalized?: boolean }
  ): Promise<void> {
    try {
      console.log(`🛒 Requesting purchase for productId: ${productId} with options:`, options);
      if (!this.isInitialized) {
        console.error('❌ IAP not initialized');
        return;
      }
      // const owned = await getAvailablePurchases();
      // console.log('🔍 Owned:', owned);
      // if (owned.length > 0) {
      //   await consumePurchase(owned[0].purchaseToken as string);
      // }
      const isOfferPersonalized = options?.isOfferPersonalized ?? false;
      const offerToken = options?.offerToken;
      const isSubscription = !!offerToken || SUBSCRIPTION_IDS.includes(productId);

      if (isSubscription) {
        const androidReq: any = {
          skus: [productId],
          isOfferPersonalized,
        };
        if (offerToken) {
          androidReq.subscriptionOffers = [
            { sku: productId, offerToken },
          ];
        }
        const requestParams: any = {
          request: {
            android: androidReq,
          },
          type: 'subs'
        };
        requestPurchase(requestParams);
      } else {
        const requestParams: any = {
          request: {
            android: {
              skus: [productId],
              isOfferPersonalized,
            }
          },
          type: 'in-app'
        };
        requestPurchase(requestParams);
      }
    } catch (error) {
      console.error('❌ Purchase request failed:', error);
    }
  }

  // Test IAP connection and environment
  public async testConnection(): Promise<void> {
    try {
      console.log('🧪 Testing IAP connection...');
      console.log('🧪 Platform:', Platform.OS);
      
      // Check if running on real device vs emulator
      const { DeviceInfo } = require('react-native');
      
      // Test with Google's test products first
      const testResult = await fetchProducts({
        skus: ['android.test.purchased'], // Google's test product
        type: 'in-app'
      });
      console.log('🧪 Test connection result:', testResult);
      
      // Try to fetch our actual products with better error handling
      if (SUBSCRIPTION_IDS.length > 0) {
        console.log('🧪 Testing actual product fetch...');
        const actualResult = await fetchProducts({
          skus: SUBSCRIPTION_IDS,
          type: 'subs'
        });
        console.log('🧪 Actual products result:', actualResult);
      }
      
    } catch (error) {
      console.error('🧪 Test connection failed:', error);
      console.error('🧪 Error details:', JSON.stringify(error, null, 2));
    }
  }

  // Check if initialized
  public isReady(): boolean {
    return this.isInitialized;
  }

  // Get all available items (products + subscriptions)
  public getAllItems(): (Product | Subscription)[] {
    return [...this.inappLeftTime, ...this.subscriptions];
  }

  // Log all available items
  public logAllItems(): void {
    console.log('📦 All In-App:', this.inappLeftTime);
    console.log('📋 All Subscriptions:', this.subscriptions);
    console.log('🛍️ All Items:', this.getAllItems());
    console.log(JSON.stringify(this.getAllItems()))
  }

  // Add purchase success callback
  public addPurchaseSuccessCallback(callback: (purchase: Purchase) => void): void {
    this.purchaseSuccessCallbacks.push(callback);
  }

  // Remove purchase success callback
  public removePurchaseSuccessCallback(callback: (purchase: Purchase) => void): void {
    const index = this.purchaseSuccessCallbacks.indexOf(callback);
    if (index > -1) {
      this.purchaseSuccessCallbacks.splice(index, 1);
    }
  }

  // Add purchase error callback
  public addPurchaseErrorCallback(callback: (error: any) => void): void {
    this.purchaseErrorCallbacks.push(callback);
  }

  // Remove purchase error callback
  public removePurchaseErrorCallback(callback: (error: any) => void): void {
    const index = this.purchaseErrorCallbacks.indexOf(callback);
    if (index > -1) {
      this.purchaseErrorCallbacks.splice(index, 1);
    }
  }

  // Show IAP modal from any component
    static showIAP(sourceComponent = 'unknown') {
        console.log(`🛒 IAP triggered from: ${sourceComponent}`);
        
        // Analytics/tracking
        // this.trackIAPShow(sourceComponent);
        
        return {
            show: true,
            source: sourceComponent
        };
    }
}


export default IAPManager;
