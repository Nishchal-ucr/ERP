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

export interface Party {
  id: number;
  name: string;
  type: object;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedItem {
  id: number;
  name: string;
  category: object;
  createdAt: string;
  updatedAt: string;
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
  birdsMortality: number;
  closingBirds: number;
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

  birdsMortality?: number;
  closingBirds?: number;
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
