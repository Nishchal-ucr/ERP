import type {
  LoginDto,
  LoginResponseDto,
  Shed,
  Party,
  FeedItem,
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

export async function getAllParties(): Promise<Party[]> {
  const response = await fetch(buildUrl("/api/parties"));
  return processResponse(response);
}

export async function getBuyerParties(): Promise<Party[]> {
  const response = await fetch(buildUrl("/api/parties?role=buyer"));
  return processResponse(response);
}

export async function getSellerParties(): Promise<Party[]> {
  const response = await fetch(buildUrl("/api/parties?role=seller"));
  return processResponse(response);
}

export async function getPartyById(id: number): Promise<Party> {
  const response = await fetch(buildUrl(`/api/parties/${id}`));
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

export type PartyRole = "seller" | "buyer";

export async function createPartyForRole(
  name: string,
  role: PartyRole,
  opts?: { phone?: string; address?: string },
): Promise<Party> {
  const body: Record<string, string> = { name, role };
  if (opts?.phone !== undefined) body.phone = opts.phone;
  if (opts?.address !== undefined) body.address = opts.address;
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
