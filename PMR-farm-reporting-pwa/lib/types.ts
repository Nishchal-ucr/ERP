// API Types and Interfaces

export interface ApiError {
  status: number;
  message: string;
}

export interface LoginDto {
  phone: string;
  password: string;
}

export interface UserResponseDto {
  id: string;
  phone: string;
  name: string;
  role: string;
}

export interface LoginResponseDto {
  message: string;
  user: UserResponseDto;
  token: string;
}

export interface Shed {
  id: number;
  name: string;
  capacity?: number;
  flockNumber?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Per-shed flock snapshot from GET /api/flock-summary */
export interface FlockSummaryRow {
  shedId: number;
  shedName: string;
  flockNumber: string | null;
  birthDate: string | null;
  closingBirds: number | null;
  ageWeeks: number | null;
}

/** POST /api/flock-placement */
export interface FlockPlacementDto {
  shedId: number;
  flockNumber: string;
  birthDate: string;
  birdCount: number;
  reportDate: string;
  submitterId: number;
}

export interface FlockPlacementResponse {
  shedId: number;
  flockNumber: string;
  birthDate: string;
  birdCount: number;
  reportDate: number;
}

/** POST /api/shed-transfer */
export interface ShedTransferDto {
  fromShedId: number;
  toShedId: number;
  reportDate: string;
  submitterId: number;
  transferMode: "all" | "count";
  birdCount?: number;
}

export interface ShedTransferResponse {
  fromShedId: number;
  toShedId: number;
  birdsTransferred: number;
  fromClosingBirds: number;
  toClosingBirds: number;
  reportDate: number;
  metadataCopied: boolean;
  warning: string | null;
}

/** POST /api/cull-bird-sales */
export interface CullBirdSalesDto {
  shedId: number;
  reportDate: string;
  submitterId: number;
  mode: "all" | "count";
  birdCount?: number;
}

export interface CullBirdSalesResponse {
  shedId: number;
  birdsRemoved: number;
  newClosingBirds: number;
  reportDate: number;
  flockCleared: boolean;
}

/** POST /api/shed-closing-override */
export interface ShedClosingOverrideDto {
  reportDate: string;
  shedId: number;
  submitterId: number;
  closingBirds: number;
  standardEggsClosing: number;
  smallEggsClosing: number;
  bigEggsClosing: number;
  feedClosing: number;
}

export interface ShedClosingOverrideResponse {
  shedDailyReportId: number;
  reportDate: number;
  shedId: number;
  closingBirds: number;
  standardEggsClosing: number;
  smallEggsClosing: number;
  bigEggsClosing: number;
  totalEggsClosing: number;
  feedClosing: number;
  nextDayAdjusted: boolean;
  nextShedDailyReportId: number | null;
}

export interface Party {
  id: number;
  name: string;
  type: "SUPPLIER" | "CUSTOMER" | "BOTH";
  phone?: string;
  address?: string;
  email?: string;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeedItem {
  id: number;
  name: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/feed-formulations */
export interface FeedFormulationRow {
  id: number;
  shedId: number;
  shedName: string | null;
  feedItemId: number;
  feedItemName: string | null;
  ratioPer1000Kg: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/feed-item-daily-stock/latest */
export interface FeedItemDailyStockRow {
  feedItemId: number;
  name: string;
  category: string;
  openingKg: number;
  receiptsKg: number;
  usedKg: number;
  closingKg: number;
  manualClosingKg: number | null;
}

export interface FeedItemDailyStockLatestDto {
  reportDate: number | null;
  items: FeedItemDailyStockRow[];
}

/** PATCH /api/feed-item-daily-stock */
export interface PatchFeedItemDailyStockItemDto {
  feedItemId: number;
  closingKg: number;
}

export interface PatchFeedItemDailyStockDto {
  reportDate: number;
  items: PatchFeedItemDailyStockItemDto[];
}

export interface CreateSaleItemDto {
  shedId: number;
  standardEggs?: number;
  smallEggs?: number;
  bigEggs?: number;
  loadingDamage?: number;
}

export interface CreateSaleDto {
  partyId: number;
  vehicleNumber: string;
  items: CreateSaleItemDto[];
}

export interface CreateFeedReceiptDto {
  partyId: number;
  feedItemId: number;
  vehicleNumber: string;
  quantityKg: number;
}

export interface CreateShedDailyReportDto {
  shedId: number;
  openingBirds?: number;
  birdsMortality: number;
  closingBirds: number;
  openingEggs?: number;
  damagedEggs: number;
  standardEggsClosing: number;
  smallEggsClosing: number;
  bigEggsClosing?: number;
  feedOpening?: number;
  feedIssued?: number;
  feedClosing?: number;
  feedConsumed?: number;
  totalEggsClosing?: number;
  eggsProduced?: number;
  // Legacy compatibility for older stored drafts/payloads.
  totalFeedReceipt?: number;
  closingFeed?: number;
}

export interface SubmitDailyReportDto {
  reportDate: string;
  submitterId: number;
  sales: CreateSaleDto[];
  feedReceipts: CreateFeedReceiptDto[];
  shedDailyReports: CreateShedDailyReportDto[];
}

export interface User {
  id: number;
  name: string;
  phone: string;
  passwordHash: string;
  role: object;
  createdAt: string;
}

export interface DailyReport {
  id: number;
  reportDate: number;
  createdByUser: User;
  createdByUserId: number;
  status: "DRAFT" | "SUBMITTED" | "LOCKED";
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShedDailyReportResponseDto {
  id: number;
  dailyReportId: number;
  shedId: number;

  openingBirds?: number;
  birdsMortality?: number;
  closingBirds?: number;
  openingEggs?: number;
  damagedEggs?: number;
  standardEggsClosing?: number;
  smallEggsClosing?: number;
  bigEggsClosing?: number;
  feedOpening?: number;
  feedIssued?: number;
  feedClosing?: number;
  feedConsumed?: number;
  totalEggsClosing?: number;
  eggsProduced?: number;
  totalFeedReceipt?: number;
  closingFeed?: number;

  createdAt: string;
  updatedAt: string;
}

export interface FeedReceiptResponseDto {
  id: number;
  dailyReportId: number;
  partyId: number;
  feedItemId: number;
  vehicleNumber?: string;
  quantityKg: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItemResponseDto {
  id: number;
  saleId: number;
  shedId: number;
  standardEggs: number;
  smallEggs: number;
  bigEggs?: number;
  loadingDamage?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaleResponseDto {
  id: number;
  dailyReportId: number;
  partyId: number;
  vehicleNumber?: string;
  items: SaleItemResponseDto[];
  createdAt: string;
  updatedAt: string;
}

export interface DailyReportResponseDto {
  id: number;
  reportDate: number;
  createdByUserId: number;
  status: "DRAFT" | "SUBMITTED" | "LOCKED";
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;

  sales?: SaleResponseDto[];
  feedReceipts?: FeedReceiptResponseDto[];
  shedDailyReports?: ShedDailyReportResponseDto[];
}
