import type {
  LoginDto,
  LoginResponseDto,
  Shed,
  Party,
  FeedItem,
  FeedFormulationRow,
  FeedItemDailyStockLatestDto,
  PatchFeedItemDailyStockDto,
  SubmitDailyReportDto,
  DailyReport,
  DailyReportResponseDto,
  FlockSummaryRow,
  FlockPlacementDto,
  FlockPlacementResponse,
  ShedTransferDto,
  ShedTransferResponse,
  CullBirdSalesDto,
  CullBirdSalesResponse,
  ShedClosingOverrideDto,
  ShedClosingOverrideResponse,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export { API_BASE_URL };

// Pure function to construct API URL
function buildUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

// Pure function to create fetch options
function createFetchOptions(
  method: string,
  body?: any,
  token?: string,
): RequestInit {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };
  if (token) {
    (options.headers as any)["Authorization"] = `Bearer ${token}`;
  }
  if (body) {
    options.body = JSON.stringify(body);
  }
  return options;
}

async function processResponse(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw { status: response.status, message: data?.message };
  }
  return data;
}

// API Endpoint Functions

export async function getHello(): Promise<string> {
  const response = await fetch(buildUrl("/"));
  return processResponse(response);
}

export async function login(dto: LoginDto): Promise<LoginResponseDto> {
  const response = await fetch(
    buildUrl("/api/user/login"),
    createFetchOptions("POST", dto),
  );
  return processResponse(response);
}

export async function getAllSheds(): Promise<Shed[]> {
  const response = await fetch(buildUrl("/api/sheds"));
  return processResponse(response);
}

export async function getShedById(id: number): Promise<Shed> {
  const response = await fetch(buildUrl(`/api/sheds/${id}`));
  return processResponse(response);
}

export async function getFlockSummary(): Promise<FlockSummaryRow[]> {
  const response = await fetch(buildUrl("/api/flock-summary"));
  return processResponse(response);
}

export async function patchShedFlockId(
  shedId: number,
  flockNumber: string,
): Promise<Shed> {
  const response = await fetch(
    buildUrl(`/api/sheds/${shedId}/flock-id`),
    createFetchOptions("PATCH", { flockNumber }),
  );
  return processResponse(response);
}

export async function postFlockPlacement(
  dto: FlockPlacementDto,
): Promise<FlockPlacementResponse> {
  const response = await fetch(
    buildUrl("/api/flock-placement"),
    createFetchOptions("POST", dto),
  );
  return processResponse(response);
}

export async function postShedTransfer(
  dto: ShedTransferDto,
): Promise<ShedTransferResponse> {
  const body: Record<string, unknown> = {
    fromShedId: dto.fromShedId,
    toShedId: dto.toShedId,
    reportDate: dto.reportDate,
    submitterId: dto.submitterId,
    transferMode: dto.transferMode,
  };
  if (dto.transferMode === "count" && dto.birdCount != null) {
    body.birdCount = dto.birdCount;
  }
  const response = await fetch(
    buildUrl("/api/shed-transfer"),
    createFetchOptions("POST", body),
  );
  return processResponse(response);
}

export async function postCullBirdSales(
  dto: CullBirdSalesDto,
): Promise<CullBirdSalesResponse> {
  const body: Record<string, unknown> = {
    shedId: dto.shedId,
    reportDate: dto.reportDate,
    submitterId: dto.submitterId,
    mode: dto.mode,
  };
  if (dto.mode === "count" && dto.birdCount != null) {
    body.birdCount = dto.birdCount;
  }
  const response = await fetch(
    buildUrl("/api/cull-bird-sales"),
    createFetchOptions("POST", body),
  );
  return processResponse(response);
}

export async function postShedClosingOverride(
  dto: ShedClosingOverrideDto,
): Promise<ShedClosingOverrideResponse> {
  const response = await fetch(
    buildUrl("/api/shed-closing-override"),
    createFetchOptions("POST", {
      reportDate: dto.reportDate,
      shedId: dto.shedId,
      submitterId: dto.submitterId,
      closingBirds: dto.closingBirds,
      standardEggsClosing: dto.standardEggsClosing,
      smallEggsClosing: dto.smallEggsClosing,
      bigEggsClosing: dto.bigEggsClosing,
      feedClosing: dto.feedClosing,
    }),
  );
  return processResponse(response);
}

export async function getAllParties(): Promise<Party[]> {
  const response = await fetch(buildUrl("/api/parties"));
  return processResponse(response);
}

export type PartiesListFilters = {
  activeFilter: "all" | "active" | "inactive";
  kindFilter: "all" | "buyer" | "seller" | "both";
};

export async function getParties(
  filters: PartiesListFilters,
): Promise<Party[]> {
  const params = new URLSearchParams();
  if (filters.activeFilter === "active") params.set("active", "true");
  if (filters.activeFilter === "inactive") params.set("active", "false");
  if (filters.kindFilter !== "all") params.set("kind", filters.kindFilter);
  const q = params.toString();
  const path = q ? `/api/parties?${q}` : "/api/parties";
  const response = await fetch(buildUrl(path));
  return processResponse(response);
}

export async function getBuyerParties(): Promise<Party[]> {
  const response = await fetch(
    buildUrl("/api/parties?role=buyer&active=true"),
  );
  return processResponse(response);
}

export async function getSellerParties(): Promise<Party[]> {
  const response = await fetch(
    buildUrl("/api/parties?role=seller&active=true"),
  );
  return processResponse(response);
}

export async function getPartyById(id: number): Promise<Party> {
  const response = await fetch(buildUrl(`/api/parties/${id}`));
  return processResponse(response);
}

export async function patchParty(
  id: number,
  body: { active: boolean },
): Promise<Party> {
  const response = await fetch(
    buildUrl(`/api/parties/${id}`),
    createFetchOptions("PATCH", body),
  );
  return processResponse(response);
}

export async function getAllFeedItems(): Promise<FeedItem[]> {
  const response = await fetch(buildUrl("/api/feed-items"));
  return processResponse(response);
}

export async function getFeedItemById(id: number): Promise<FeedItem> {
  const response = await fetch(buildUrl(`/api/feed-items/${id}`));
  return processResponse(response);
}

export type PartyRole = "seller" | "buyer" | "both";

export async function createPartyForRole(
  name: string,
  role: PartyRole,
  opts?: { phone?: string; address?: string; email?: string },
): Promise<Party> {
  const body: Record<string, string> = { name, role };
  if (opts?.phone !== undefined) body.phone = opts.phone;
  if (opts?.address !== undefined) body.address = opts.address;
  if (opts?.email !== undefined) body.email = opts.email;
  const response = await fetch(
    buildUrl("/api/parties"),
    createFetchOptions("POST", body),
  );
  return processResponse(response);
}

export type FeedItemCategory = "INGREDIENT" | "MEDICINE";

export async function createFeedItem(
  name: string,
  category: FeedItemCategory = "INGREDIENT",
  closingKg: number = 0,
): Promise<FeedItem> {
  const response = await fetch(
    buildUrl("/api/feed-items"),
    createFetchOptions("POST", { name, category, closingKg }),
  );
  return processResponse(response);
}

export async function getFeedFormulations(): Promise<FeedFormulationRow[]> {
  const response = await fetch(buildUrl("/api/feed-formulations"));
  return processResponse(response);
}

export async function patchFeedFormulation(
  id: number,
  body: { ratioPer1000Kg: number },
): Promise<FeedFormulationRow> {
  const response = await fetch(
    buildUrl(`/api/feed-formulations/${id}`),
    createFetchOptions("PATCH", body),
  );
  return processResponse(response);
}

export async function createFeedFormulation(body: {
  shedId: number;
  feedItemId: number;
  ratioPer1000Kg: number;
}): Promise<FeedFormulationRow> {
  const response = await fetch(
    buildUrl("/api/feed-formulations"),
    createFetchOptions("POST", body),
  );
  return processResponse(response);
}

export async function deleteFeedFormulation(
  id: number,
): Promise<{ deleted: boolean; id: number }> {
  const response = await fetch(
    buildUrl(`/api/feed-formulations/${id}`),
    createFetchOptions("DELETE"),
  );
  return processResponse(response);
}

export async function deleteFeedItem(
  id: number,
): Promise<{ deleted: boolean; id: number }> {
  const response = await fetch(
    buildUrl(`/api/feed-items/${id}`),
    createFetchOptions("DELETE"),
  );
  return processResponse(response);
}

export async function getFeedItemDailyStockLatest(): Promise<FeedItemDailyStockLatestDto> {
  const response = await fetch(
    buildUrl("/api/feed-item-daily-stock/latest"),
  );
  return processResponse(response);
}

export async function patchFeedItemDailyStock(
  dto: PatchFeedItemDailyStockDto,
): Promise<FeedItemDailyStockLatestDto> {
  const response = await fetch(
    buildUrl("/api/feed-item-daily-stock"),
    createFetchOptions("PATCH", dto),
  );
  return processResponse(response);
}

export async function submitDailyReport(
  dto: SubmitDailyReportDto,
): Promise<DailyReport> {
  const response = await fetch(
    buildUrl("/api/daily-reports/submit"),
    createFetchOptions("POST", dto),
  );
  return processResponse(response);
}

export async function updateDailyReport(
  dto: SubmitDailyReportDto,
): Promise<DailyReport> {
  const response = await fetch(
    buildUrl("/api/daily-reports/update"),
    createFetchOptions("PUT", dto),
  );
  return processResponse(response);
}

export async function getAllDailyReports(): Promise<DailyReport[]> {
  const response = await fetch(buildUrl("/api/daily-reports"));
  return processResponse(response);
}

export async function getDailyReportById(
  id: number,
): Promise<DailyReportResponseDto> {
  const response = await fetch(buildUrl(`/api/daily-reports/${id}`));
  return processResponse(response);
}

export async function getDailyReportByDate(
  date: string,
): Promise<DailyReportResponseDto> {
  const response = await fetch(buildUrl(`/api/daily-reports/by-date/${date}`));
  return processResponse(response);
}
